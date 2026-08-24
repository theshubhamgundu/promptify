export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'prompt_champ_offline_queue';

export class OfflineQueue {
  static getQueue(): OfflineAction[] {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static enqueue(action: Omit<OfflineAction, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    const newAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    queue.push(newAction);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Attempt to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  static dequeue(id: string) {
    const queue = this.getQueue();
    const filtered = queue.filter(a => a.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  }

  static clear() {
    localStorage.removeItem(QUEUE_KEY);
  }

  static async processQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    for (const action of queue) {
      try {
        await this.handleAction(action);
        this.dequeue(action.id);
      } catch (error) {
        console.error('Failed to process offline action', action, error);
        // Break out and leave remaining actions in the queue
        break;
      }
    }
  }

  private static async handleAction(action: OfflineAction) {
    // Basic dispatcher for different action types
    switch (action.type) {
      case 'SAVE_DRAFT':
        // e.g. await supabase.from('submissions').update({ content: action.payload.content }).eq('id', action.payload.id)
        break;
      case 'SUBMIT_ANSWER':
        // logic
        break;
      default:
        console.warn('Unknown offline action type', action.type);
    }
  }
}

// Add a listener to process queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    OfflineQueue.processQueue();
  });
}
