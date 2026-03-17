// wasm 加载状态
export const WASM_LOAD_STATUS = Object.freeze({
  LOADING: 0, // 加载中
  LOADED: 1, // 加载完成
  FAIL: 99, // 加载失败
});

// 模型加载状态
export const MODEL_LOAD_STATUS = Object.freeze({
  EMPTY: 0, // 空状态
  DOWNLOADING: 1, // 下载中
  MODEL_LOADING: 2, // 模型加载中
  LOADED: 3, // 模型加载完成
  FAIL: 99, // 加载失败
});

export const SETTINGS_KEY = 'qwen3-chat-view-settings';