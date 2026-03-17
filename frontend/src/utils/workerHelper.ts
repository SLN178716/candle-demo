import type { WorkerMessage } from './workerManager';

type HandlerFunction = (data: any) => any | Promise<any>;

export default class WorkerHelper {
  private handlers: Map<string, HandlerFunction> = new Map();

  private async handleRequest(id: string, action: string, data: any): Promise<void> {
    try {
      const handler = this.handlers.get(action);
      if (handler) {
        const result = await handler(data);
        self.postMessage({ id, type: 'response', data: result });
      } else {
        self.postMessage({ id, type: 'error', data: `No handler registered for action: ${action}` });
      }
    } catch (error) {
      self.postMessage({ id, type: 'error', data: error instanceof Error ? error.message : error });
    }
  }
  
  register(action: string, handler: HandlerFunction): void {
    this.handlers.set(action, handler);
  }

  start() {
    self.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { id, type, action, data } = event.data;
      if (type === 'request') {
        this.handleRequest(id, action, data);
      }
    };
  }
}