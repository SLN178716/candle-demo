<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  clearModelFileCache,
  isModelFileCacheSupported,
  loadModelArrayBuffer,
} from '../../utils/modelFileCache'

type StatusType = 'loading' | 'ready' | 'error'

type ModelPaths = {
  model: string
  tokenizer: string
  config: string
}

type LoadSource = {
  model: '' | 'cache' | 'network'
  tokenizer: '' | 'cache' | 'network'
  config: '' | 'cache' | 'network'
}

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
  thinking: string
  thinkingCollapsed: boolean
  streaming: boolean
}

type ParsedResponse = {
  thinking: string
  response: string
}

type WasmModel = {
  get_message_count: () => number
  get_cached_token_count: () => number
  start_conversation: (systemPrompt?: string, enableThinking?: boolean) => void
  chat: (
    userMessage: string,
    temp: number,
    topP: number,
    repeatPenalty: number,
    repeatLastN: number,
    seed: number,
    enableThinking: boolean,
  ) => string
  next_token: () => string
  is_eos: () => boolean
  end_turn: () => void
  get_conversation_json: () => string
}

type WasmModule = {
  default: () => Promise<void>
  Model: new (weights: Uint8Array, tokenizer: Uint8Array, config: Uint8Array) => WasmModel
  profile_clear?: () => void
  profile_print_stats?: () => void
  get_wasm_memory_info?: () => string
}

type SavedSettings = Partial<ModelPaths> & { cacheEnabled?: boolean }

const SETTINGS_KEY = 'qwen3-chat-view-settings'
const DEFAULT_PATHS: ModelPaths = {
  model: '/models/qwen3/Qwen3-0.6B-Q8_0.gguf',
  tokenizer: '/models/qwen3/tokenizer.json',
  config: '/models/qwen3/config.json',
}

const statusText = ref('初始化中...')
const statusType = ref<StatusType>('loading')
const cacheInfo = ref('')
const memoryInfo = ref('加载中...')
const loadSource = ref<LoadSource>({
  model: '',
  tokenizer: '',
  config: '',
})

const messages = ref<ChatMessage[]>([])
const userInput = ref('')
const enableThinking = ref(true)
const maxTokens = ref(500)
const modelPaths = ref<ModelPaths>({ ...DEFAULT_PATHS })
const cacheSupported = ref(isModelFileCacheSupported())
const cacheEnabled = ref(cacheSupported.value)

const isReady = ref(false)
const isGenerating = ref(false)
const shouldStopGeneration = ref(false)
const messageIdCounter = ref(0)

const chatThreadRef = ref<HTMLDivElement | null>(null)
let model: WasmModel | null = null
let wasmExports: WasmModule | null = null

const canSend = computed(
  () => isReady.value && !isGenerating.value && userInput.value.trim().length > 0,
)

const statusTagType = computed(() => {
  if (statusType.value === 'ready') return 'success'
  if (statusType.value === 'error') return 'danger'
  return 'warning'
})

const cacheModeText = computed(() => {
  if (!cacheSupported.value) return '当前浏览器不支持 IndexedDB'
  return cacheEnabled.value ? '已启用本地缓存' : '已禁用本地缓存'
})

const modelSourceText = computed(() => {
  const source = loadSource.value
  if (!source.model && !source.tokenizer && !source.config) return ''
  return `model:${source.model || '-'} tokenizer:${source.tokenizer || '-'} config:${source.config || '-'}`
})

const showEmptyState = computed(() => messages.value.length === 0)

const toErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

const readSavedSettings = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as SavedSettings
    modelPaths.value = {
      model: parsed.model || DEFAULT_PATHS.model,
      tokenizer: parsed.tokenizer || DEFAULT_PATHS.tokenizer,
      config: parsed.config || DEFAULT_PATHS.config,
    }
    if (cacheSupported.value && typeof parsed.cacheEnabled === 'boolean') {
      cacheEnabled.value = parsed.cacheEnabled
    }
  } catch {
    modelPaths.value = { ...DEFAULT_PATHS }
  }
}

const saveSettings = () => {
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      model: modelPaths.value.model,
      tokenizer: modelPaths.value.tokenizer,
      config: modelPaths.value.config,
      cacheEnabled: cacheEnabled.value,
    }),
  )
}

const setStatus = (text: string, type: StatusType) => {
  statusText.value = text
  statusType.value = type
}

const scrollToBottom = async () => {
  await nextTick()
  const container = chatThreadRef.value
  if (container) container.scrollTop = container.scrollHeight
}

const updateCacheInfo = () => {
  if (!model) return
  cacheInfo.value = `${model.get_message_count()} messages | ${model.get_cached_token_count()} tokens cached`
}

const updateMemoryInfo = () => {
  try {
    if (!wasmExports || !wasmExports.get_wasm_memory_info) return
    memoryInfo.value = wasmExports.get_wasm_memory_info()
  } catch {
    memoryInfo.value = ''
  }
}

const parseResponse = (fullText: string, thinkingEnabled: boolean): ParsedResponse => {
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

const cleanTokens = (text: string): string => {
  return text
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/<think>/g, '')
    .replace(/<\/think>/g, '')
    .trim()
}

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

const loadWasmModule = async (): Promise<WasmModule> => {
  const candidates = ['/src/wasm-pkg/qwen3/candle_wasm_example_quant_qwen3.js', '/wasm-pkg/qwen3/candle_wasm_example_quant_qwen3.js']
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return (await import(/* @vite-ignore */ candidate)) as WasmModule
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(toErrorMessage(lastError || 'WASM 模块加载失败'))
}

const loadFileByConfig = async (name: keyof LoadSource, url: string): Promise<ArrayBuffer> => {
  const useCache = cacheSupported.value && cacheEnabled.value
  const cacheKey = `qwen3:${name}:${url}`
  const result = await loadModelArrayBuffer(url, cacheKey, useCache)
  loadSource.value[name] = result.fromCache ? 'cache' : 'network'
  return result.buffer
}

const loadModel = async () => {
  try {
    isReady.value = false
    model = null
    loadSource.value = { model: '', tokenizer: '', config: '' }
    setStatus('初始化 WASM...', 'loading')
    wasmExports = await loadWasmModule()
    await wasmExports.default()

    setStatus('加载模型文件...', 'loading')
    const [weights, tokenizer, config] = await Promise.all([
      loadFileByConfig('model', modelPaths.value.model),
      loadFileByConfig('tokenizer', modelPaths.value.tokenizer),
      loadFileByConfig('config', modelPaths.value.config),
    ])

    setStatus('创建模型实例...', 'loading')
    wasmExports.profile_clear?.()
    model = new wasmExports.Model(
      new Uint8Array(weights),
      new Uint8Array(tokenizer),
      new Uint8Array(config),
    )
    model.start_conversation(undefined, enableThinking.value)

    isReady.value = true
    setStatus('模型就绪', 'ready')
    updateCacheInfo()
    updateMemoryInfo()
  } catch (error) {
    isReady.value = false
    setStatus(`初始化失败: ${toErrorMessage(error)}`, 'error')
  }
}

const applyModelSettings = async () => {
  if (isGenerating.value) return
  saveSettings()
  await loadModel()
}

const clearLocalCache = async () => {
  if (!cacheSupported.value) {
    setStatus('当前浏览器不支持 IndexedDB 缓存', 'error')
    return
  }
  await clearModelFileCache()
  setStatus('本地模型缓存已清除', 'ready')
}

const sendMessage = async () => {
  if (!model || !canSend.value) return
  const input = userInput.value.trim()
  if (!input) return

  userInput.value = ''
  addUserMessage(input)
  const assistantMessage = addAssistantMessage()
  await scrollToBottom()

  isGenerating.value = true
  shouldStopGeneration.value = false

  try {
    setStatus('生成中...', 'loading')
    wasmExports?.profile_clear?.()
    const startAt = performance.now()
    const tokenLimit = Math.max(1, Math.min(2000, maxTokens.value))

    const firstToken = model.chat(
      input,
      0.6,
      0.9,
      1.1,
      64,
      Date.now(),
      enableThinking.value,
    )

    let allText = firstToken
    let tokenCount = 1
    let parsed = parseResponse(allText, enableThinking.value)
    assistantMessage.thinking = parsed.thinking
    assistantMessage.content = parsed.response
    await scrollToBottom()

    for (let i = 0; i < tokenLimit - 1; i += 1) {
      if (shouldStopGeneration.value || model.is_eos()) break

      const token = model.next_token()
      allText += token
      tokenCount += 1

      parsed = parseResponse(allText, enableThinking.value)
      assistantMessage.thinking = parsed.thinking
      assistantMessage.content = parsed.response

      if (tokenCount % 10 === 0) {
        const seconds = (performance.now() - startAt) / 1000
        const speed = seconds > 0 ? (tokenCount / seconds).toFixed(1) : '0.0'
        setStatus(`生成中... ${tokenCount} tokens (${speed} tok/s)`, 'loading')
        updateCacheInfo()
        await scrollToBottom()
        await Promise.resolve()
      }
    }

    model.end_turn()
    assistantMessage.streaming = false
    const totalSeconds = (performance.now() - startAt) / 1000
    const finalSpeed = totalSeconds > 0 ? (tokenCount / totalSeconds).toFixed(1) : '0.0'
    setStatus(`${tokenCount} tokens / ${totalSeconds.toFixed(1)}s (${finalSpeed} tok/s)`, 'ready')
    updateCacheInfo()
    updateMemoryInfo()
  } catch (error) {
    assistantMessage.streaming = false
    assistantMessage.content = `Error: ${toErrorMessage(error)}`
    setStatus(`生成失败: ${toErrorMessage(error)}`, 'error')
  } finally {
    isGenerating.value = false
  }
}

const stopGeneration = () => {
  shouldStopGeneration.value = true
}

const newConversation = () => {
  if (!model) return
  model.start_conversation(undefined, enableThinking.value)
  messages.value = []
  wasmExports?.profile_clear?.()
  updateCacheInfo()
  setStatus('新会话已创建', 'ready')
}

const showStats = () => {
  wasmExports?.profile_print_stats?.()
  if (model) window.console.log('Conversation JSON:', model.get_conversation_json())
}

const onInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(() => {
  readSavedSettings()
  void loadModel()
})
</script>

<template>
  <div class="chat-page">
    <el-card class="header-card" shadow="never">
      <h2>Qwen3 Chat</h2>
      <p>基于 Candle + WebAssembly，在浏览器中运行量化 Qwen3 模型。</p>
      <div class="path-config">
        <el-input v-model="modelPaths.model" placeholder="模型文件地址" :disabled="isGenerating">
          <template #prepend>Model</template>
        </el-input>
        <el-input v-model="modelPaths.tokenizer" placeholder="Tokenizer 文件地址" :disabled="isGenerating">
          <template #prepend>Tokenizer</template>
        </el-input>
        <el-input v-model="modelPaths.config" placeholder="Config 文件地址" :disabled="isGenerating">
          <template #prepend>Config</template>
        </el-input>
        <div class="path-actions">
          <el-switch
            v-model="cacheEnabled"
            :disabled="!cacheSupported || isGenerating"
            inline-prompt
            active-text="缓存开"
            inactive-text="缓存关"
          />
          <span class="cache-mode">{{ cacheModeText }}</span>
          <el-button :disabled="isGenerating" @click="clearLocalCache">清除缓存</el-button>
          <el-button type="primary" :disabled="isGenerating" @click="applyModelSettings">
            应用路径并重载
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="panel-card" shadow="never">
      <template #header>
        <div class="status-bar">
          <el-tag :type="statusTagType">{{ statusText }}</el-tag>
          <span class="cache-info">{{ cacheInfo }}</span>
        </div>
        <div v-if="modelSourceText" class="source-info">{{ modelSourceText }}</div>
      </template>

      <div ref="chatThreadRef" class="chat-thread">
        <div v-if="showEmptyState" class="empty-state">
          <h3>开始对话</h3>
          <p>输入问题后点击发送，模型会逐 token 生成回复。</p>
        </div>

        <div v-for="message in messages" :key="message.id" class="message" :class="message.role">
          <template v-if="message.role === 'assistant' && message.thinking">
            <el-button text type="primary" class="thinking-toggle" @click="message.thinkingCollapsed = !message.thinkingCollapsed">
              {{ message.thinkingCollapsed ? '展开推理过程' : '收起推理过程' }}
            </el-button>
            <pre v-show="!message.thinkingCollapsed" class="thinking-content">{{ message.thinking }}</pre>
          </template>

          <pre class="message-content">{{ message.content }}</pre>
          <span v-if="message.streaming" class="streaming-dot"></span>
        </div>
      </div>

      <div class="input-area">
        <el-input
          v-model="userInput"
          type="textarea"
          :rows="2"
          :autosize="{ minRows: 2, maxRows: 6 }"
          :disabled="!isReady || isGenerating"
          placeholder="输入消息，Enter发送，Shift+Enter换行"
          @keydown="onInputKeydown"
        />

        <div class="options-row">
          <el-checkbox v-model="enableThinking" :disabled="!isReady || isGenerating">Thinking mode</el-checkbox>
          <div class="max-tokens">
            <span>Max tokens</span>
            <el-input-number v-model="maxTokens" :min="1" :max="2000" :step="50" :disabled="!isReady || isGenerating" />
          </div>
        </div>

        <div class="button-row">
          <el-button type="primary" :disabled="!canSend" @click="sendMessage">发送</el-button>
          <el-button type="danger" :disabled="!isGenerating" @click="stopGeneration">停止</el-button>
          <el-button :disabled="!isReady || isGenerating" @click="newConversation">新会话</el-button>
          <el-button :disabled="!isReady || isGenerating" @click="showStats">统计</el-button>
          <span class="memory-info">{{ memoryInfo }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 96px);
}

.header-card h2 {
  margin: 0 0 6px;
}

.header-card p {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.path-config {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.path-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cache-mode {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.cache-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: 'Courier New', monospace;
}

.source-info {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--el-text-color-secondary);
}

.message {
  max-width: 85%;
  border-radius: 12px;
  padding: 12px;
}

.message.user {
  align-self: flex-end;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.message.assistant {
  align-self: flex-start;
  background: var(--el-fill-color-light);
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
  background: #e8ecff;
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
  background: #667eea;
  animation: pulse 1s infinite;
}

.input-area {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.options-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.max-tokens {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.button-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.memory-info {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: 'Courier New', monospace;
}

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
