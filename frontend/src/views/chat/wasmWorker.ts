import WorkerHelper from '../../utils/workerHelper'

type WasmModule = typeof import('../../wasm-pkg/qwen3/candle_wasm_example_quant_qwen3')

let wasmModule: WasmModule | null = null
let model: InstanceType<WasmModule['Model']> | null = null

const initWasm = async () => {
  wasmModule = await import('../../wasm-pkg/qwen3/candle_wasm_example_quant_qwen3')
  console.log('WASM 模块加载成功')
  return true
}

const loadModel = ({
  weights,
  tokenizer,
  config,
  enableThinking
}: {
  weights: ArrayBufferLike,
  tokenizer: ArrayBufferLike,
  config: ArrayBufferLike,
  enableThinking: boolean
}) => {
  if (!wasmModule) throw new Error('WASM 模块未加载')
  wasmModule.profile_clear()
  model = new wasmModule.Model(
    new Uint8Array(weights),
    new Uint8Array(tokenizer),
    new Uint8Array(config),
  )
  model.start_conversation(undefined, enableThinking)
}

// 获取缓存信息显示
const getCacheInfo = () => {
  if (!model) throw new Error('模型未加载')
  return {
    messageCount: model.get_message_count(),
    tokenCount: model.get_token_count(),
    cachedTokenCount: model.get_cached_token_count(),
  }
}

// 获取内存信息显示
const getMemoryInfo = () => {
  if (!wasmModule) throw new Error('WASM 模块未加载')
  return {
    memoryInfo: wasmModule.get_memory_info(),
    wasmMemoryInfo: wasmModule.get_wasm_memory_info(),
  }
}

const workerHelper = new WorkerHelper()
workerHelper.register('init-wasm', initWasm)
workerHelper.register('load-model', loadModel)
workerHelper.register('get-cache-info', getCacheInfo)
workerHelper.register('get-memory-info', getMemoryInfo)
workerHelper.start()
