<template>
  <div
    class="chat-view"
    v-loading="wasmLoadStatus === WASM_LOAD_STATUS.LOADING"
    element-loading-text="页面加载中..."
  >
    <div class="chat-content">
      <el-empty description="WASM 模块加载失败！" v-if="wasmLoadStatus === WASM_LOAD_STATUS.FAIL" />
      <template v-else-if="wasmLoadStatus === WASM_LOAD_STATUS.LOADED">
        <el-result
          v-if="modelLoadStatus !== MODEL_LOAD_STATUS.LOADED"
          :title="
            {
              [MODEL_LOAD_STATUS.EMPTY]: '请选择模型',
              [MODEL_LOAD_STATUS.DOWNLOADING]: '模型下载中',
              [MODEL_LOAD_STATUS.MODEL_LOADING]: '模型初始化中',
              [MODEL_LOAD_STATUS.FAIL]: '模型加载失败',
            }[modelLoadStatus]
          "
          :icon="modelLoadStatus === MODEL_LOAD_STATUS.FAIL ? 'error' : 'primary'"
        >
          <template
            v-if="
              modelLoadStatus === MODEL_LOAD_STATUS.DOWNLOADING ||
              modelLoadStatus === MODEL_LOAD_STATUS.MODEL_LOADING
            "
            #icon
          >
            <el-progress type="dashboard" :percentage="modelLoadPercentage" />
          </template>
        </el-result>
        <el-card class="chat-card" v-else>
          <template #header>
            <div class="header">
              <h3>{{ activeModelInfo?.label }}</h3>
              <div class="running-info">
                <div class="info-item-container">
                  <span class="info-item">总Token数: {{ cacheInfo.tokenCount }}</span>
                  <span class="info-item">缓存消息数: {{ cacheInfo.messageCount }}</span>
                  <span class="info-item">缓存Token数: {{ cacheInfo.cachedTokenCount }}</span>
                </div>
                <div class="info-item-container">
                  <span class="info-item">{{ memoryInfo.wasmMemoryInfo }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- 聊天消息区域 -->
          <div ref="chatThreadRef" class="chat-thread">
            <!-- 空状态提示 -->
            <div v-if="messages.length === 0" class="empty-state">
              <h3>开始对话</h3>
              <p>输入问题后点击发送，模型会逐 token 生成回复。</p>
            </div>

            <!-- 消息列表 -->
            <div
              v-for="message in messages"
              :key="message.id"
              class="message"
              :class="message.role"
            >
              <!-- 助手消息的思考过程 -->
              <template v-if="message.role === 'assistant' && message.thinking">
                <el-button
                  text
                  type="primary"
                  class="thinking-toggle"
                  @click="message.thinkingCollapsed = !message.thinkingCollapsed"
                >
                  {{ message.thinkingCollapsed ? '展开推理过程' : '收起推理过程' }}
                </el-button>
                <pre v-show="!message.thinkingCollapsed" class="thinking-content">{{
                  message.thinking
                }}</pre>
              </template>

              <!-- 消息内容 -->
              <pre class="message-content">{{ message.content }}</pre>
              <!-- 流式生成指示器 -->
              <span v-if="message.streaming" class="streaming-dot"></span>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="input-area">
            <!-- 消息输入框 -->
            <el-input
              v-model="userInput"
              type="textarea"
              :rows="2"
              :autosize="{ minRows: 2, maxRows: 2 }"
              :disabled="isGenerating"
              placeholder="输入消息，Enter发送，Shift+Enter换行"
              @keydown="onInputKeydown"
            />

            <!-- 按钮操作行 -->
            <div class="button-row">
              <el-button type="primary" :disabled="!canSend" @click="sendMessage">发送</el-button>
              <el-button type="danger" :disabled="!isGenerating" @click="stopGeneration"
                >停止</el-button
              >
              <el-button :disabled="isGenerating" @click="newConversation">新会话</el-button>
              <el-button :disabled="isGenerating" @click="showStats">统计</el-button>
            </div>
          </div>
        </el-card>
      </template>
    </div>
    <div class="chat-option">
      <el-card class="chat-option-card" header="模型配置">
        <el-form :model="option" ref="modelOptionRef" label-position="top">
          <el-form-item label="模型" prop="activeModel">
            <el-select v-model="option.activeModel" placeholder="请选择模型">
              <el-option
                v-for="item in modelList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="模型缓存" prop="cacheEnabled">
            <el-switch
              v-if="cacheSupported"
              v-model="option.cacheEnabled"
              inline-prompt
              active-text="启用"
              inactive-text="禁用"
            />
            <span v-else class="cache-mode">当前浏览器不支持本地缓存</span>
          </el-form-item>
          <el-form-item label="思考模式" prop="enableThinking">
            <el-switch
              v-model="option.enableThinking"
              inline-prompt
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              v-if="cacheSupported"
              :disabled="
                modelLoadStatus === MODEL_LOAD_STATUS.DOWNLOADING ||
                modelLoadStatus === MODEL_LOAD_STATUS.MODEL_LOADING
              "
              @click="clearLocalCache"
              >清除缓存</el-button
            >
            <el-button
              :disabled="wasmLoadStatus !== WASM_LOAD_STATUS.LOADED"
              :loading="
                modelLoadStatus === MODEL_LOAD_STATUS.DOWNLOADING ||
                modelLoadStatus === MODEL_LOAD_STATUS.MODEL_LOADING
              "
              type="primary"
              @click="applyModelSettings"
              >应用模型</el-button
            >
          </el-form-item>
        </el-form>
        <el-form
          v-if="option.activeModel"
          :model="option"
          :disabled="isGenerating"
          ref="paramsOptionRef"
          label-position="top"
        >
          <el-form-item label="最大Token限制" prop="maxTokens">
            <el-input-number v-model="option.maxTokens" :min="1" :max="2000" :step="50" />
          </el-form-item>
          <el-form-item label="思考模式" prop="enableThinking">
            <el-switch
              v-model="option.enableThinking"
              inline-prompt
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, type Ref, nextTick } from 'vue';
import { ElMessage } from 'element-plus';

import { modelList } from './modelList';
import {
  clearModelFileCache,
  isModelFileCacheSupported,
  loadModelArrayBuffer,
} from '../../utils/modelFileCache';
import WorkerManager from '../../utils/workerManager';
import { WASM_LOAD_STATUS, MODEL_LOAD_STATUS, SETTINGS_KEY } from './constants';
import wasmWorker from './wasmWorker?worker';

const wasmWorkerManager = new WorkerManager(wasmWorker);

const cacheSupported = ref(isModelFileCacheSupported()); // 浏览器是否支持缓存
const option = ref({
  activeModel: '',
  cacheEnabled: false,
  enableThinking: false,
  maxTokens: 1000,
});
// 清除本地模型文件缓存
const clearLocalCache = () => {
  clearModelFileCache()
    .then(() => {
      ElMessage.success('模型缓存已清除');
    })
    .catch((error) => {
      console.error('清除模型缓存失败:', error);
      ElMessage.error('清除模型缓存失败');
    });
};
// 当前选择的模型信息
const activeModelInfo = computed(() => {
  const { activeModel } = option.value;
  return modelList.find((item) => item.value === activeModel);
});
// 应用模型设置并重新加载模型
const applyModelSettings = async () => {
  const { activeModel } = option.value;
  if (!activeModel) {
    ElMessage.warning('请选择模型');
    return;
  }
  const { modelPath, tokenizerPath, configPath } = activeModelInfo.value!;
  // 缓存用户配置
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(option.value));
  loadModel(modelPath, tokenizerPath, configPath);
};
// 根据配置加载文件（支持缓存）
const loadFileByConfig = async (
  name: string,
  url: string,
  onProgress?: (receivedSize: number, totalSize: number) => void,
): Promise<ArrayBufferLike> => {
  const useCache = cacheSupported.value && option.value.cacheEnabled;
  const cacheKey = `qwen3:${name}:${url}`;
  const result = await loadModelArrayBuffer(url, cacheKey, useCache, onProgress);
  return result.buffer;
};
// 模型加载状态
const modelLoadStatus: Ref<(typeof MODEL_LOAD_STATUS)[keyof typeof MODEL_LOAD_STATUS]> = ref(
  MODEL_LOAD_STATUS.EMPTY,
);
// 模型下载进度
const modelLoadPercentage = ref(0);
const cacheInfo = ref({
  messageCount: 0,
  tokenCount: 0,
  cachedTokenCount: 0,
});
const memoryInfo = ref({
  memoryInfo: '',
  wasmMemoryInfo: '',
});
// 加载模型
const loadModel = (modelPath: string, tokenizerPath: string, configPath: string) => {
  if (wasmLoadStatus.value !== 1) {
    ElMessage.error('WASM 模块加载失败，请刷新页面重试！');
    return;
  }
  modelLoadStatus.value = MODEL_LOAD_STATUS.DOWNLOADING;
  modelLoadPercentage.value = 0;
  Promise.all([
    loadFileByConfig('model', modelPath, (loaded, total) => {
      modelLoadPercentage.value = loaded >= total ? 100 : (loaded / total) * 100;
    }),
    loadFileByConfig('tokenizer', tokenizerPath),
    loadFileByConfig('config', configPath),
  ])
    .then(async ([weights, tokenizer, config]) => {
      modelLoadPercentage.value = 100;
      modelLoadStatus.value = MODEL_LOAD_STATUS.MODEL_LOADING;
      await wasmWorkerManager.request('load-model', {
        weights,
        tokenizer,
        config,
        enableThinking: option.value.enableThinking,
      });
      modelLoadStatus.value = MODEL_LOAD_STATUS.LOADED;
      ElMessage.success('模型加载成功');

      cacheInfo.value = await wasmWorkerManager.request('get-cache-info');
      memoryInfo.value = await wasmWorkerManager.request('get-memory-info');
    })
    .catch((error) => {
      modelLoadStatus.value = MODEL_LOAD_STATUS.FAIL;
      console.error('模型加载失败:', error);
      ElMessage.error('模型加载失败！');
    });
};

// 聊天消息数据结构
type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  thinking: string;
  thinkingCollapsed: boolean;
  streaming: boolean;
};
const messages = ref<ChatMessage[]>([]); // 聊天消息列表
const userInput = ref(''); // 用户输入内容
const isGenerating = ref(false); // 是否正在生成回复
// 计算属性：是否可以发送消息
const canSend = computed(() => !isGenerating.value && userInput.value.trim().length > 0);
// 处理输入框键盘事件
const onInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};
// 显示性能统计信息
const showStats = () => {
  wasmWorkerManager
    .request('get-profile-info')
    .then((profileInfo) => {
      console.log('会话信息:', profileInfo);
      ElMessage.info('性能统计信息已显示在控制台中');
    })
    .catch((error) => {
      console.error('获取性能统计信息失败:', error);
      ElMessage.error('获取性能统计信息失败');
    });
};
// 停止当前生成过程
const shouldStopGeneration = ref(false)
const stopGeneration = () => {
  shouldStopGeneration.value = true
};
// 发送消息给模型并处理回复生成
const sendMessage = async () => {
  const content = userInput.value.trim()
  userInput.value = ''
  addUserMessage(content)
  const assistantMessage = addAssistantMessage()
  scrollToBottom()

  isGenerating.value = true
  shouldStopGeneration.value = false

  try {
    const tokenLimit = option.value.maxTokens

    let allText = await wasmWorkerManager.request('chat-first-token', {
      input: content,
      temp: 0.6,
      top_p: 0.9,
      repeat_penalty: 1.1,
      repeat_last_n: 64,
      seed: Date.now(),
      enableThinking: option.value.enableThinking,
    })

    let tokenCount = 1
    let parsed = parseResponse(allText, option.value.enableThinking)
    assistantMessage.thinking = parsed.thinking
    assistantMessage.content = parsed.response
    await scrollToBottom()

    // 逐 token 生成回复
    for (let i = 0; i < tokenLimit - 1; i += 1) {
      if (shouldStopGeneration.value || await wasmWorkerManager.request('is-eos')) break

      const token = await wasmWorkerManager.request('chat-next-token')
      allText += token
      tokenCount += 1

      parsed = parseResponse(allText, option.value.enableThinking)
      assistantMessage.thinking = parsed.thinking
      assistantMessage.content = parsed.response

      // 每 10 个 token 更新一次状态和滚动位置
      if (tokenCount % 10 === 0) {
        cacheInfo.value = await wasmWorkerManager.request('get-cache-info');
        scrollToBottom()
      }
    }

    await wasmWorkerManager.request('end-turn')
    assistantMessage.streaming = false
    
    cacheInfo.value = await wasmWorkerManager.request('get-cache-info');
    memoryInfo.value = await wasmWorkerManager.request('get-memory-info');
  } catch (error) {
    assistantMessage.streaming = false
    assistantMessage.content = `Error: ${String((error as { message: unknown })?.message || error)}`
  } finally {
    isGenerating.value = false
  }
};
// 开始新会话
const newConversation = () => {
  wasmWorkerManager
    .request('new-conversation', { enableThinking: option.value.enableThinking })
    .then(async () => {
      ElMessage.success('新会话已创建');
      messages.value = [];
      cacheInfo.value = await wasmWorkerManager.request('get-cache-info');
    })
    .catch((error) => {
      console.error('新会话开始失败:', error);
      ElMessage.error('新会话开始失败');
    });
};
const messageIdCounter = ref(0)
// 添加用户消息到聊天列表
const addUserMessage = (content: string) => {
  messageIdCounter.value += 1
  messages.value.push({
    id: messageIdCounter.value,
    role: 'user',
    content,
    thinking: '',
    thinkingCollapsed: true,
    streaming: false,
  })
}
// 添加助手消息到聊天列表并返回消息对象
const addAssistantMessage = (): ChatMessage => {
  messageIdCounter.value += 1
  const message: ChatMessage = {
    id: messageIdCounter.value,
    role: 'assistant',
    content: '',
    thinking: '',
    thinkingCollapsed: true,
    streaming: true,
  }
  messages.value.push(message)
  return message
}
// 滚动到聊天区域底部
const chatThreadRef = ref<HTMLDivElement>()
const scrollToBottom = async () => {
  await nextTick()
  const container = chatThreadRef.value
  if (container) container.scrollTop = container.scrollHeight
}
// 解析模型响应，分离思考过程和最终回复
const parseResponse = (fullText: string, thinkingEnabled: boolean) => {
  if (!thinkingEnabled) {
    return { thinking: '', response: cleanTokens(fullText) }
  }

  const lastThinkStart = fullText.lastIndexOf('<think>')
  const lastThinkEnd = fullText.lastIndexOf('</think>')

  if (lastThinkStart > lastThinkEnd) {
    return { thinking: cleanTokens(fullText), response: '' }
  }

  if (lastThinkEnd !== -1) {
    const thinkingRaw = fullText.substring(0, lastThinkEnd)
    const responseRaw = fullText.substring(lastThinkEnd + 8)
    return { thinking: cleanTokens(thinkingRaw), response: cleanTokens(responseRaw) }
  }

  return { thinking: cleanTokens(fullText), response: '' }
}
// 清理 token 中的特殊标记
const cleanTokens = (text: string): string => {
  return text
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/<think>/g, '')
    .replace(/<\/think>/g, '')
    .trim()
}

const wasmLoadStatus: Ref<(typeof WASM_LOAD_STATUS)[keyof typeof WASM_LOAD_STATUS]> = ref(
  WASM_LOAD_STATUS.LOADING,
);
// 从本地缓存加载用户配置
const initUserSettings = async () => {
  const settings = window.localStorage.getItem(SETTINGS_KEY);
  if (settings) {
    const { activeModel, cacheEnabled, enableThinking } = JSON.parse(settings);
    option.value.enableThinking = enableThinking;
    if (cacheEnabled === true && cacheSupported.value) {
      option.value.cacheEnabled = cacheEnabled;
    }
    // 检查模型是否存在
    const modelConfig = modelList.find((item) => item.value === activeModel);
    if (modelConfig) {
      option.value.activeModel = activeModel;
      if (wasmLoadStatus.value === WASM_LOAD_STATUS.LOADED) {
        loadModel(modelConfig.modelPath, modelConfig.tokenizerPath, modelConfig.configPath);
      }
    }
  }
};

onMounted(() => {
  wasmWorkerManager
    .request('init-wasm')
    .then(() => {
      wasmLoadStatus.value = WASM_LOAD_STATUS.LOADED;
      ElMessage.success('WASM 模块加载成功');
    })
    .catch((error) => {
      wasmLoadStatus.value = WASM_LOAD_STATUS.FAIL;
      console.error('WASM 模块加载失败:', error);
      ElMessage.error('WASM 模块加载失败，请刷新页面重试！');
    })
    .finally(() => {
      initUserSettings();
    });
});
onBeforeUnmount(() => {
  wasmWorkerManager.terminate();
});
</script>

<style lang="scss" scoped>
// SCSS 变量定义
$primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$thinking-bg: #e8ecff;
$streaming-dot-color: #667eea;
$secondary-text-color: var(--el-text-color-secondary);
$fill-light: var(--el-fill-color-light);
$border-color: var(--el-border-color);

.chat-view {
  height: 100%;
  display: flex;
  flex-direction: row;

  .chat-content {
    height: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;

    .chat-card {
      width: 100%;
      height: 100%;

      .header {
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;

        .running-info {
          color: #666666;
          font-size: smaller;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;

          .info-item-container {
            padding: 5px 0;
            margin-bottom: 5px;

            .info-item {
              padding: 5px 10px;
              border-radius: 5px;
              background-color: #f5f5f5;
              margin-right: 5px;

              &:last-child {
                margin-right: 0;
              }
            }

            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }

      // 聊天线程区域
      .chat-thread {
        height: calc(100% - 130px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 6px 0;

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: $secondary-text-color;
        }

        // 消息样式
        .message {
          max-width: 85%;
          border-radius: 12px;
          padding: 12px;

          &.user {
            align-self: flex-end;
            color: #fff;
            background: $primary-gradient;
          }

          &.assistant {
            align-self: flex-start;
            background: $fill-light;
          }

          .message-content {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
            font-family: inherit;
          }

          .thinking-toggle {
            margin-bottom: 6px;
            padding: 0;
          }

          .thinking-content {
            margin: 0 0 8px;
            border-radius: 8px;
            padding: 10px;
            background: $thinking-bg;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 220px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
          }

          .streaming-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-left: 8px;
            border-radius: 50%;
            background: $streaming-dot-color;
            animation: pulse 1s infinite;
          }
        }
      }

      // 输入区域
      .input-area {
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid $border-color;
        display: flex;
        flex-direction: column;
        gap: 10px;

        .options-row {
          display: flex;
          align-items: center;
          gap: 16px;

          .max-tokens {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
        }

        .button-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .memory-info {
            margin-left: auto;
            font-size: 12px;
            color: $secondary-text-color;
            font-family: 'Courier New', monospace;
          }
        }
      }
    }
  }

  .chat-option {
    height: 100%;
    width: 300px;
    margin-left: 20px;

    .chat-option-card {
      height: 100%;
    }
  }
}

// 动画定义
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
