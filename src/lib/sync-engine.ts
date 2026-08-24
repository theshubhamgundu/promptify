import { OfflineQueue } from './offline-queue';

export class SyncEngine {
  static init() {
    if (typeof window === 'undefined') return;
    
    // Automatically process queue when coming back online
    window.addEventListener('online', () => {
      console.log('Device is back online, processing sync queue...');
      OfflineQueue.processQueue();
    });

    // Optionally set up an interval to try syncing in case events are missed
    setInterval(() => {
      if (navigator.onLine && OfflineQueue.getQueue().length > 0) {
        console.log('Periodic sync queue check...');
        OfflineQueue.processQueue();
      }
    }, 30000); // Check every 30 seconds
  }

  static getPendingCount() {
    return OfflineQueue.getQueue().length;
  }
}
