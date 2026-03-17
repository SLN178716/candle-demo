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
        <el-card v-else>
          <template #header>
            <div class="header">
              <h2>{{ activeModelInfo?.label }}</h2>
              <div class="running-info">
                <div class="info-item-container">
                  <span class="info-item">总令牌数: {{ cacheInfo.tokenCount }}</span>
                  <span class="info-item">缓存消息数: {{ cacheInfo.messageCount }}</span>
                  <span class="info-item">缓存令牌数: {{ cacheInfo.cachedTokenCount }}</span>
                </div>
                <div class="info-item-container">
                  <span class="info-item">{{ memoryInfo.wasmMemoryInfo }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-card>
      </template>
    </div>
    <div class="chat-option">
      <el-card header="模型配置">
        <el-form :model="option" ref="optionRef" label-position="top">
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
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, type Ref } from 'vue';
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
      console.log('cacheInfo:', cacheInfo.value);
      memoryInfo.value = await wasmWorkerManager.request('get-memory-info');
      console.log('memoryInfo:', memoryInfo.value);
    })
    .catch((error) => {
      modelLoadStatus.value = MODEL_LOAD_STATUS.FAIL;
      console.error('模型加载失败:', error);
      ElMessage.error('模型加载失败！');
    });
};

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

          .info-item {
            padding: 5px 10px;
            border-radius: 5px;
            background-color: #f5f5f5;
            margin-right: 5px;

            &:last-child {
              margin-right: 0;
            }
          }
        }
      }
    }
  }

  .chat-option {
    height: 100%;
    width: 300px;
    border-left: 1px solid $border-color;
  }
}
</style>
