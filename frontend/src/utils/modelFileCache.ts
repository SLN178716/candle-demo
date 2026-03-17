const DB_NAME = 'candle-model-cache'
const DB_VERSION = 1
const STORE_NAME = 'model_files'

type CacheRecord = {
  key: string
  buffer: ArrayBuffer
  size: number
  updatedAt: number
}

type LoadResult = {
  buffer: ArrayBufferLike
  fromCache: boolean
}

let dbPromise: Promise<IDBDatabase | null> | null = null

export const isModelFileCacheSupported = (): boolean => {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (!isModelFileCacheSupported()) {
    return Promise.resolve(null)
  }

  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error || new Error('打开缓存数据库失败'))
    }
  }).catch(() => null)

  return dbPromise
}

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (
    store: IDBObjectStore,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => void,
): Promise<T | null> => {
  const db = await openDatabase()
  if (!db) return null

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    executor(store, resolve, reject)
  }).catch(() => null)
}

export const readModelFileCache = async (key: string): Promise<CacheRecord | null> => {
  return runTransaction<CacheRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => {
      resolve((request.result as CacheRecord | undefined) ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

export const writeModelFileCache = async (
  key: string,
  buffer: ArrayBufferLike,
): Promise<boolean | null> => {
  return runTransaction<boolean>('readwrite', (store, resolve, reject) => {
    const request = store.put({
      key,
      buffer,
      size: buffer.byteLength,
      updatedAt: Date.now(),
    } as CacheRecord)
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

export const clearModelFileCache = async (): Promise<boolean | null> => {
  return runTransaction<boolean>('readwrite', (store, resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

export const loadModelArrayBuffer = async (
  url: string,
  cacheKey: string,
  useCache: boolean,
  onProgress?: (receivedSize: number, totalSize: number) => void,
): Promise<LoadResult> => {
  if (useCache) {
    const cached = await readModelFileCache(cacheKey)
    if (cached && cached.buffer) {
      return {
        buffer: cached.buffer,
        fromCache: true,
      }
    }
  }

  const response = await fetch(url)
  const totalSize = Number(response.headers.get('content-length') || '0')

  if (!response.ok) {
    throw new Error(`文件加载失败: ${url}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error(`文件加载失败: ${url}`)
  }

  let receivedSize = 0
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedSize += value.length
    if (totalSize > 0) {
      onProgress?.(receivedSize, totalSize)
    }
  }

  let offset = 0
  const buffer = chunks.reduce((acc, chunk) => {
    acc.set(chunk, offset)
    offset += chunk.length
    return acc
  }, new Uint8Array(receivedSize))

  const arrayBuffer = buffer.buffer
  if (useCache) {
    await writeModelFileCache(cacheKey, arrayBuffer)
  }

  return {
    buffer: arrayBuffer,
    fromCache: false,
  }
}
