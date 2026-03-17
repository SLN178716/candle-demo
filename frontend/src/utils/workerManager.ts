export interface WorkerMessage {
  id: string;
  type: 'request' | 'error' | 'response';
  action: string;
  data: any;
}

type Callback = (error: Error | null, result: any) => void;

export default class WorkerManager {
  private worker: Worker;
  private callbackMap: Map<string, Callback> = new Map();

  constructor(WorkerClass: { new (): Worker }) {
    this.worker = new WorkerClass();
    this.initWorker();
  }

  private initWorker() {
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { id, type, data } = event.data;
      if (type === 'response') {
        this.handleResponse(id, data);
      } else if (type === 'error') {
        this.handleError(id, data);
      }
    };
    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.callbackMap.forEach((callback, id) => {
        callback(new Error(error.message), null);
        this.callbackMap.delete(id);
      });
    };
  }

  private handleResponse(id: string, data: any) {
    const callback = this.callbackMap.get(id);
    if (callback) {
      callback(null, data);
      this.callbackMap.delete(id);
    }
  }

  private handleError(id: string, err: any) {
    const callback = this.callbackMap.get(id);
    if (callback) {
      callback(new Error(err), null);
      this.callbackMap.delete(id);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  request<T = any>(action: string, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      this.callbackMap.set(id, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res as T);
        }
      });
      this.worker.postMessage({ id, type: 'request', action, data });
    });
  }

  requestSync(action: string, callback: Callback, data?: any): void {
    const id = this.generateId();
    this.callbackMap.set(id, callback);
    this.worker.postMessage({ id, type: 'request', action, data });
  }

  terminate(): void {
    this.worker.terminate();
  }
}