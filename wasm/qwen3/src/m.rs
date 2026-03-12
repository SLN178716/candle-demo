use candle_core::quantized::gguf_file;
use candle_core::{DType, Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use wasm_chat_template::{ChatTemplate, ChatTemplateOptions, Conversation, Message};
use js_sys::Date;
use std::io::Cursor;
use tokenizers::Tokenizer;
use wasm_bindgen::prelude::*;

use crate::profiler::ProfileGuard;
use candle_transformers::models::quantized_qwen3::ModelWeights as QuantizedQwen3;

/// Model 结构体封装了 Qwen3 量化模型及其相关组件
/// 通过 #[wasm_bindgen] 导出给 JavaScript 使用
#[wasm_bindgen]
pub struct Model {
    /// 实际的量化模型权重
    model: QuantizedQwen3,
    /// 分词器，用于将文本转换为 token ID
    tokenizer: Tokenizer,
    /// Logits 处理器，负责采样策略（如 temperature, top-p）
    logits_processor: LogitsProcessor,
    /// 重复惩罚系数
    repeat_penalty: f32,
    /// 重复惩罚考虑的最近 token 数量
    repeat_last_n: usize,
    /// 结束符 token ID
    eos_token: u32,
    /// 是否启用思考过程（Chain of Thought）
    enable_thinking: bool,

    // === KV Cache 管理 ===
    /// KV 缓存中已存在的实际 token ID
    /// 这是模型已处理内容的唯一事实来源
    kv_tokens: Vec<u32>,

    /// 当前助手回合生成的 token
    current_gen_tokens: Vec<u32>,

    // === 对话状态 ===
    /// 文本层面的对话历史（用于导出或显示）
    conversation: Option<Conversation>,

    /// 生成过程中累积的当前助手回复文本
    current_response: String,

    /// 标记是否为第一轮对话（第一轮需要处理完整的模板，后续只需处理增量）
    is_first_turn: bool,
}

#[wasm_bindgen]
impl Model {
    /// 构造函数：加载模型权重和分词器配置
    /// weights: GGUF 格式的模型权重数据
    /// tokenizer: 分词器配置文件数据
    /// _config: 模型配置文件数据（目前未使用）
    #[wasm_bindgen(constructor)]
    pub fn load(weights: Vec<u8>, tokenizer: Vec<u8>, _config: Vec<u8>) -> Result<Model, JsError> {
        let _prof = ProfileGuard::new("total_load");
        // 设置 panic 钩子，使得 Rust panic 信息能输出到 JS 控制台
        console_error_panic_hook::set_once();

        // 指定使用 CPU 设备
        let device = Device::Cpu;

        let _prof = ProfileGuard::new("load_tokenizer");
        console_log!("Loading tokenizer...");
        // 加载分词器
        let tokenizer =
            Tokenizer::from_bytes(&tokenizer).map_err(|m| JsError::new(&m.to_string()))?;

        // 获取 EOS (End of Sequence) token
        // 优先尝试 <|endoftext|>，其次 <|im_end|>，如果都找不到则使用 0 并警告
        let eos_token = match tokenizer.get_vocab(true).get("<|endoftext|>") {
            Some(&token) => token,
            None => match tokenizer.get_vocab(true).get("<|im_end|>") {
                Some(&token) => token,
                None => {
                    console_log!("Warning: no EOS token found, using 0");
                    0
                }
            },
        };

        let start = Date::now();
        console_log!(
            "Weights size: {} bytes ({:.2} MB)",
            weights.len(),
            weights.len() as f64 / 1_048_576.0
        );

        // 解析并加载 GGUF 模型
        let model = {
            let _prof = ProfileGuard::new("parse_gguf");

            let mut cursor = Cursor::new(weights);
            let content = gguf_file::Content::read(&mut cursor)
                .map_err(|e| JsError::new(&format!("Failed to read GGUF: {}", e)))?;

            console_log!("GGUF file parsed, loading model weights...");

            QuantizedQwen3::from_gguf(content, &mut cursor, &device)?
        };

        let load_time = (Date::now() - start) / 1000.0;
        console_log!("Quantized model loaded in {:.2}s", load_time);

        // 初始化 LogitsProcessor，种子暂时设为固定值
        let logits_processor = LogitsProcessor::new(299792458, None, None);

        Ok(Self {
            model,
            tokenizer,
            logits_processor,
            repeat_penalty: 1.,
            repeat_last_n: 64,
            eos_token,
            enable_thinking: true,
            kv_tokens: Vec::new(),
            current_gen_tokens: Vec::new(),
            conversation: None,
            current_response: String::new(),
            is_first_turn: true,
        })
    }

    // ========================================================================
    // 对话管理 (Conversation Management)
    // ========================================================================

    /// 初始化一个新的对话，设置系统提示词和选项。
    /// 这会清空 KV 缓存并重新开始。
    /// system_prompt: 可选的自定义系统提示词
    /// enable_thinking: 是否启用思考模式
    #[wasm_bindgen]
    pub fn start_conversation(&mut self, system_prompt: Option<String>, enable_thinking: bool) {
        let _prof = ProfileGuard::new("start_conversation");

        self.enable_thinking = enable_thinking;

        // 清空 KV 缓存以开始新对话
        self.model.clear_kv_cache();
        self.kv_tokens.clear();
        self.current_gen_tokens.clear();
        self.current_response.clear();
        self.is_first_turn = true;

        // 构建带有元数据的合适系统提示词
        let reasoning_mode = if enable_thinking {
            "/think"
        } else {
            "/no_think"
        };
        let default_system = format!(
            "## Metadata\n\n\
Reasoning Mode: {}\n\n\
## Custom Instructions\n\n\
You are a helpful AI assistant.",
            reasoning_mode
        );

        let system = system_prompt.unwrap_or(default_system);

        let template = ChatTemplate::chatml_with_thinking();
        let options = ChatTemplateOptions::for_generation().thinking(enable_thinking);
        let conv = Conversation::new(template, system).with_options(options);

        self.conversation = Some(conv);

        console_log!("Conversation started (reasoning mode: {})", reasoning_mode);
    }

    /// 从 tokenizer_config.json 内容加载对话模板。
    /// tokenizer_config_json: 分词器配置文件的 JSON 字符串
    #[wasm_bindgen]
    pub fn start_conversation_from_config(
        &mut self,
        tokenizer_config_json: &str,
        system_prompt: Option<String>,
        enable_thinking: bool,
    ) -> Result<(), JsError> {
        let _prof = ProfileGuard::new("start_conversation_from_config");

        self.enable_thinking = enable_thinking;

        // 清空 KV 缓存以开始新对话
        self.model.clear_kv_cache();
        self.kv_tokens.clear();
        self.current_gen_tokens.clear();
        self.current_response.clear();
        self.is_first_turn = true;

        let template = ChatTemplate::from_config_json(tokenizer_config_json)
            .map_err(|e| JsError::new(&e.to_string()))?;
        let options = ChatTemplateOptions::for_generation().thinking(enable_thinking);

        let conv = match system_prompt {
            Some(prompt) => Conversation::new(template, prompt).with_options(options),
            None => Conversation::without_system(template).with_options(options),
        };

        self.conversation = Some(conv);

        console_log!("Conversation started from config");
        Ok(())
    }

    /// 发送用户消息并准备生成回复。
    ///
    /// 此方法通过仅对新内容进行分词来高效重用 KV 缓存：
    /// - 第一轮：对完整提示词（系统+用户+助手开始）进行分词
    /// - 后续轮次：仅对续写部分（关闭上一轮+新用户+助手开始）进行分词
    ///
    /// `enable_thinking` 参数控制此特定消息是否使用思考模式。
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen]
    pub fn chat(
        &mut self,
        user_message: String,
        temp: f64,
        top_p: f64,
        repeat_penalty: f32,
        repeat_last_n: usize,
        seed: f64,
        enable_thinking: bool,
    ) -> Result<String, JsError> {
        let _prof = ProfileGuard::new("chat");

        // 确保对话已初始化
        if self.conversation.is_none() {
            self.start_conversation(None, enable_thinking);
        }

        // 更新此消息的思考模式
        self.enable_thinking = enable_thinking;

        // 清除新一轮的生成状态
        self.current_gen_tokens.clear();
        self.current_response.clear();

        // 设置 Logits 处理器（温度、Top-P）
        let temp = if temp <= 0. { None } else { Some(temp) };
        let top_p = if top_p <= 0. || top_p >= 1. {
            None
        } else {
            Some(top_p)
        };
        self.logits_processor = LogitsProcessor::new(seed as u64, temp, top_p);
        self.repeat_penalty = repeat_penalty;
        self.repeat_last_n = repeat_last_n;

        // 仅对新内容进行分词（而不是整个对话历史）
        let new_tokens = if self.is_first_turn {
            let conv = self
                .conversation
                .as_mut()
                .ok_or_else(|| JsError::new("No conversation initialized"))?;

            // 更新此特定轮次的思考模式
            conv.set_options(ChatTemplateOptions::for_generation().thinking(enable_thinking));

            // user_turn() 添加消息并返回格式化后的提示词
            let prompt = conv
                .user_turn(&user_message)
                .map_err(|e| JsError::new(&e.to_string()))?;

            console_log!("First turn prompt:\n{}", prompt);

            let tokens = {
                let _prof = ProfileGuard::new("tokenize_prompt");
                self.tokenizer
                    .encode(prompt.as_str(), true)
                    .map_err(|m| JsError::new(&m.to_string()))?
                    .get_ids()
                    .to_vec()
            };

            self.is_first_turn = false;
            tokens
        } else {
            // 后续轮次：仅对续写部分分词
            // 添加到对话历史（用于文本导出）
            if let Some(conv) = self.conversation.as_mut() {
                conv.add_message(Message::user(&user_message));
            }

            // 仅格式化新部分：关闭之前的助手回复 + 新用户消息 + 助手开始标签
            let continuation = self.format_continuation(&user_message, enable_thinking);

            let tokens = {
                let _prof = ProfileGuard::new("tokenize_continuation");
                self.tokenizer
                    .encode(continuation.as_str(), false) // false = 不添加特殊 token
                    .map_err(|m| JsError::new(&m.to_string()))?
                    .get_ids()
                    .to_vec()
            };

            tokens
        };

        let start_pos = self.kv_tokens.len();
        let num_messages = self.conversation.as_ref().map(|c| c.len()).unwrap_or(0);

        console_log!(
            "Chat: {} messages, {} cached tokens, {} new tokens, thinking: {}",
            num_messages,
            start_pos,
            new_tokens.len(),
            if enable_thinking { "on" } else { "off" }
        );

        if new_tokens.is_empty() {
            return Ok(String::new());
        }

        // 处理新 token 并获取第一个生成的 token
        let (text, first_gen_token) = self
            .process_prompt(&new_tokens, start_pos)
            .map_err(|m| JsError::new(&m.to_string()))?;

        // 更新 KV token 跟踪：仅添加提示词 token（它们现在已经在 KV 缓存中了）
        // first_gen_token 尚未在 KV 缓存中 - 它将在 next_token() 中处理
        self.kv_tokens.extend_from_slice(&new_tokens);
        self.current_gen_tokens.push(first_gen_token);

        // 累积回复文本
        self.current_response.push_str(&text);

        Ok(text)
    }

    /// 结束当前轮次并记录助手的回复。
    /// 生成的 token 会保留在 KV 缓存中供下一轮使用。
    #[wasm_bindgen]
    pub fn end_turn(&mut self) {
        let _prof = ProfileGuard::new("end_turn");

        if let Some(conv) = self.conversation.as_mut() {
            // 在对话历史中记录完整的回复文本
            let response = self.current_response.clone();
            conv.assistant_response(&response);

            // 注意：current_gen_tokens 包含所有生成的 token，但只有 len-1 个在 KV 缓存中
            // (最后一个尚未处理，但它是 EOS，所以没关系)
            console_log!(
                "Turn ended: {} messages, {} tokens in KV cache, {} tokens generated",
                conv.len(),
                self.kv_tokens.len(),
                self.current_gen_tokens.len()
            );
        }

        self.current_response.clear();
        self.current_gen_tokens.clear();
    }

    /// 清空对话历史但保留系统提示词。
    /// 也会清空 KV 缓存，因为我们是重新开始。
    #[wasm_bindgen]
    pub fn clear_conversation(&mut self) {
        if let Some(conv) = self.conversation.as_mut() {
            conv.clear();
        }
        self.model.clear_kv_cache();
        self.kv_tokens.clear();
        self.current_gen_tokens.clear();
        self.current_response.clear();
        self.is_first_turn = true;
        console_log!("Conversation cleared");
    }

    /// 获取 JSON 格式的对话历史。
    #[wasm_bindgen]
    pub fn get_conversation_json(&self) -> String {
        match &self.conversation {
            Some(conv) => conv.to_json(),
            None => "[]".to_string(),
        }
    }

    /// 获取对话中的消息数量。
    #[wasm_bindgen]
    pub fn get_message_count(&self) -> usize {
        match &self.conversation {
            Some(conv) => conv.len(),
            None => 0,
        }
    }

    /// 获取当前 KV 缓存中的 token 数量。
    #[wasm_bindgen]
    pub fn get_cached_token_count(&self) -> usize {
        self.kv_tokens.len()
    }

    // ========================================================================
    // Token 生成 (Token Generation)
    // ========================================================================

    /// 生成下一个 token。
    #[wasm_bindgen]
    pub fn next_token(&mut self) -> Result<String, JsError> {
        let _prof = ProfileGuard::new("next_token");

        // 获取上一个采样的 token（尚未处理/添加到 KV）
        let token_to_process = *self
            .current_gen_tokens
            .last()
            .ok_or_else(|| JsError::new("No tokens to continue from"))?;

        let text = self
            .process_generation(token_to_process)
            .map_err(|m| JsError::new(&m.to_string()))?;

        // 累积回复
        self.current_response.push_str(&text);

        Ok(text)
    }

    /// 检查上一个生成的 token 是否为 EOS。
    #[wasm_bindgen]
    pub fn is_eos(&self) -> bool {
        self.current_gen_tokens
            .last()
            .is_some_and(|&t| t == self.eos_token)
    }

    /// 获取 KV 缓存中的总 token 数量。
    #[wasm_bindgen]
    pub fn get_token_count(&self) -> usize {
        self.kv_tokens.len()
    }

    /// 一次性生成多个 token。
    #[wasm_bindgen]
    pub fn generate_tokens(&mut self, count: usize) -> Result<String, JsError> {
        let _prof = ProfileGuard::new("generate_tokens_batch");

        let mut result = String::new();

        for _ in 0..count {
            if self.is_eos() {
                break;
            }

            let text = self.next_token()?;
            result.push_str(&text);
        }

        Ok(result)
    }

    /// 完全重置模型（清空 KV 缓存和所有状态）。
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        let _prof = ProfileGuard::new("reset_model");
        self.kv_tokens.clear();
        self.current_gen_tokens.clear();
        self.current_response.clear();
        self.conversation = None;
        self.is_first_turn = true;
        self.model.clear_kv_cache();
    }
}

    // ============================================================================
    // 私有实现 (Private Implementation)
    // ============================================================================

    impl Model {
        /// 格式化后续轮次的续写内容。
        /// 这仅生成所需的 token：关闭上一轮，添加用户消息，开始助手回复。
        /// KV 缓存中已经包含了在此之前的所有内容。
        fn format_continuation(&self, user_message: &str, enable_thinking: bool) -> String {
            // ChatML 格式续写：
            // <|im_end|>           (关闭之前的助手回合)
            // <|im_start|>user
            // {user_message}<|im_end|>
            // <|im_start|>assistant
            // <think>              (总是存在)
            // \n</think>\n         (如果是 no_think 模式，则预填充以跳过推理)
            //
            // 注意：推理模式在对话开始时的系统提示词中设置，
            // 但我们仍然可以通过预填充 think 标签来引导每条消息的行为

            let assistant_start = if enable_thinking {
                "<|im_start|>assistant\n<think>\n" // 开启推理
            } else {
                "<|im_start|>assistant\n<think>\n\n</think>\n" // 空内容 = 跳过推理
            };

            let result = format!(
                "<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n{}",
                user_message, assistant_start
            );

            console_log!("Continuation format:\n{}", result);
            result
        }

        /// 处理提示词 token 并返回生成的第一个 token。
        /// 注意：这会在内部更新 KV 缓存，但不会修改 kv_tokens。
        /// 调用者 (chat/init_with_prompt) 负责 token 跟踪。
        fn process_prompt(
            &mut self,
            tokens: &[u32],
            start_pos: usize,
        ) -> candle_core::Result<(String, u32)> {
            let _prof = ProfileGuard::new("process_prompt");

            let dev = Device::Cpu;

            let input = {
                let _prof = ProfileGuard::new("create_input_tensor");
                Tensor::new(tokens, &dev)?.unsqueeze(0)?
            };

            // 前向传播所有提示词 token
            let logits = {
                let _prof = ProfileGuard::new("model_forward_prompt");
                self.model.forward(&input, start_pos)?
            };

            let logits = {
                let _prof = ProfileGuard::new("logits_post_process");
                logits.squeeze(0)?.to_dtype(DType::F32)?
            };

            // 使用所有 token（缓存 + 新提示词）应用重复惩罚
            let all_context: Vec<u32> = self
                .kv_tokens
                .iter()
                .chain(tokens.iter())
                .copied()
                .collect();

            let logits = if self.repeat_penalty == 1. {
                logits
            } else {
                let _prof = ProfileGuard::new("apply_repeat_penalty");
                let start_at = all_context.len().saturating_sub(self.repeat_last_n);
                candle_transformers::utils::apply_repeat_penalty(
                    &logits,
                    self.repeat_penalty,
                    &all_context[start_at..],
                )?
            };

            // 采样第一个 token
            let next_token = {
                let _prof = ProfileGuard::new("sample_token");
                self.logits_processor.sample(&logits)?
            };

            // 解码 token
            let token_str = {
                let _prof = ProfileGuard::new("decode_token");
                match self.tokenizer.decode(&[next_token], false) {
                    Ok(s) => s,
                    Err(e) => {
                        console_log!("Error decoding token: {:?}", e);
                        String::new()
                    }
                }
            };

            Ok((token_str, next_token))
        }

        /// 处理生成过程中的单个 token。
        /// 传入的 token 尚未在 kv_tokens 中 - 处理后会添加。
        fn process_generation(&mut self, token_to_process: u32) -> candle_core::Result<String> {
            let _prof = ProfileGuard::new("process_generation");

            let dev = Device::Cpu;

            let input = {
                let _prof = ProfileGuard::new("create_input_tensor");
                Tensor::new(&[token_to_process], &dev)?.unsqueeze(0)?
            };

            // 位置是序列中的下一个插槽（token_to_process 尚未添加）
            let pos = self.kv_tokens.len();

            // 单个 token 的前向传播 - 这会将其添加到 KV 缓存
            let logits = {
                let _prof = ProfileGuard::new("model_forward_gen");
                self.model.forward(&input, pos)?
            };

            // 现在将处理后的 token 添加到 kv_tokens（它现在在 KV 缓存中了）
            self.kv_tokens.push(token_to_process);

            let logits = {
                let _prof = ProfileGuard::new("logits_post_process");
                logits.squeeze(0)?.to_dtype(DType::F32)?
            };

            // 应用重复惩罚
            let logits = if self.repeat_penalty == 1. {
                logits
            } else {
                let _prof = ProfileGuard::new("apply_repeat_penalty");
                let start_at = self.kv_tokens.len().saturating_sub(self.repeat_last_n);
                candle_transformers::utils::apply_repeat_penalty(
                    &logits,
                    self.repeat_penalty,
                    &self.kv_tokens[start_at..],
                )?
            };

            // 采样下一个 token
            let next_token = {
                let _prof = ProfileGuard::new("sample_token");
                self.logits_processor.sample(&logits)?
            };

            // 跟踪新采样的 token（尚未在 kv_tokens 中 - 将在下一次迭代中处理）
            self.current_gen_tokens.push(next_token);

            // 解码 token
            let token_str = {
                let _prof = ProfileGuard::new("decode_token");
                match self.tokenizer.decode(&[next_token], false) {
                    Ok(s) => s,
                    Err(e) => {
                        console_log!("Error decoding token: {:?}", e);
                        String::new()
                    }
                }
            };

            Ok(token_str)
        }
    }
