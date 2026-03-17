/* tslint:disable */
/* eslint-disable */

/**
 * A chat message with role and content
 */
export class Message {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a new message with the given role and content
     */
    constructor(role: string, content: string);
    /**
     * Get the message content
     */
    readonly content: string;
    /**
     * Get the message role
     */
    readonly role: string;
}

/**
 * Model 结构体封装了 Qwen3 量化模型及其相关组件
 * 通过 #[wasm_bindgen] 导出给 JavaScript 使用
 */
export class Model {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 发送用户消息并准备生成回复。
     *
     * 此方法通过仅对新内容进行分词来高效重用 KV 缓存：
     * - 第一轮：对完整提示词（系统+用户+助手开始）进行分词
     * - 后续轮次：仅对续写部分（关闭上一轮+新用户+助手开始）进行分词
     *
     * `enable_thinking` 参数控制此特定消息是否使用思考模式。
     */
    chat(user_message: string, temp: number, top_p: number, repeat_penalty: number, repeat_last_n: number, seed: number, enable_thinking: boolean): string;
    /**
     * 清空对话历史但保留系统提示词。
     * 也会清空 KV 缓存，因为我们是重新开始。
     */
    clear_conversation(): void;
    /**
     * 结束当前轮次并记录助手的回复。
     * 生成的 token 会保留在 KV 缓存中供下一轮使用。
     */
    end_turn(): void;
    /**
     * 一次性生成多个 token。
     */
    generate_tokens(count: number): string;
    /**
     * 获取当前 KV 缓存中的 token 数量。
     */
    get_cached_token_count(): number;
    /**
     * 获取 JSON 格式的对话历史。
     */
    get_conversation_json(): string;
    /**
     * 获取对话中的消息数量。
     */
    get_message_count(): number;
    /**
     * 获取 KV 缓存中的总 token 数量。
     */
    get_token_count(): number;
    /**
     * 检查上一个生成的 token 是否为 EOS。
     */
    is_eos(): boolean;
    /**
     * 构造函数：加载模型权重和分词器配置
     * weights: GGUF 格式的模型权重数据
     * tokenizer: 分词器配置文件数据
     * _config: 模型配置文件数据（目前未使用）
     */
    constructor(weights: Uint8Array, tokenizer: Uint8Array, _config: Uint8Array);
    /**
     * 生成下一个 token。
     */
    next_token(): string;
    /**
     * 完全重置模型（清空 KV 缓存和所有状态）。
     */
    reset(): void;
    /**
     * 初始化一个新的对话，设置系统提示词和选项。
     * 这会清空 KV 缓存并重新开始。
     * system_prompt: 可选的自定义系统提示词
     * enable_thinking: 是否启用思考模式
     */
    start_conversation(system_prompt: string | null | undefined, enable_thinking: boolean): void;
    /**
     * 从 tokenizer_config.json 内容加载对话模板。
     * tokenizer_config_json: 分词器配置文件的 JSON 字符串
     */
    start_conversation_from_config(tokenizer_config_json: string, system_prompt: string | null | undefined, enable_thinking: boolean): void;
}

export class ProfileStats {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly json: string;
}

export function get_memory_info(): string;

export function get_wasm_memory_info(): string;

export function log_memory(): void;

export function log_wasm_memory(): void;

export function profile_clear(): void;

export function profile_enable(enabled: boolean): void;

export function profile_get_stats(): ProfileStats;

export function profile_print_stats(): void;
