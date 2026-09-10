export interface VideoItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  isBuiltIn?: boolean;
  duration?: string;
}

export interface VideoPlayerConfig {
  videoUrl: string;
  title?: string;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
  objectFit: 'cover' | 'contain';
  playbackRate?: number;
}

const DEFAULT_VIDEOS: VideoItem[] = [
  {
    id: 'cinematic-loop',
    name: 'Promptify Animated Loop',
    url: '/assets/cinematic_loop.mp4',
    description: 'Animated Promptify Text Motion Graphic Loop',
    isBuiltIn: true,
    duration: 'Motion Loop',
  },
];

const DEFAULT_CONFIG: VideoPlayerConfig = {
  videoUrl: '/assets/cinematic_loop.mp4',
  title: 'Promptify Animated Loop',
  loop: true,
  muted: true,
  autoplay: true,
  objectFit: 'cover',
  playbackRate: 1,
};

const STORAGE_KEY_CUSTOM_VIDEOS = 'promptify_custom_videos';
const STORAGE_KEY_GLOBAL_VIDEO = 'promptify_global_video_config';
const STORAGE_KEY_SCREEN_VIDEO_PREFIX = 'promptify_screen_video_config_';

// ── Persistent IndexedDB Storage Layer for Videos ────────────────────────────
const DB_NAME = 'promptify_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

let inMemoryCustomVideos: VideoItem[] = [];

function openAssetsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('backgrounds')) {
        db.createObjectStore('backgrounds', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initialize memory from localStorage first
try {
  const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_VIDEOS);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) inMemoryCustomVideos = parsed;
  }
} catch (e) {}

// Async hydrate from IndexedDB
export async function initVideoStorage(): Promise<VideoItem[]> {
  try {
    const db = await openAssetsDB();
    if (!db.objectStoreNames.contains(STORE_NAME)) return [...DEFAULT_VIDEOS, ...inMemoryCustomVideos];
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();

    return new Promise((resolve) => {
      getAllReq.onsuccess = () => {
        const idbVideos: VideoItem[] = getAllReq.result || [];
        if (idbVideos.length > 0) {
          const map = new Map<string, VideoItem>();
          idbVideos.forEach(v => map.set(v.id, v));
          inMemoryCustomVideos.forEach(v => map.set(v.id, v));
          inMemoryCustomVideos = Array.from(map.values());
        }
        notifyVideoChanges();
        resolve([...DEFAULT_VIDEOS, ...inMemoryCustomVideos]);
      };
      getAllReq.onerror = () => {
        resolve([...DEFAULT_VIDEOS, ...inMemoryCustomVideos]);
      };
    });
  } catch (e) {
    return [...DEFAULT_VIDEOS, ...inMemoryCustomVideos];
  }
}

if (typeof window !== 'undefined') {
  initVideoStorage();
}

async function persistVideoToIndexedDB(video: VideoItem): Promise<void> {
  try {
    const db = await openAssetsDB();
    if (db.objectStoreNames.contains(STORE_NAME)) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(video);
    }
  } catch (e) {}
}

async function deleteVideoFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openAssetsDB();
    if (db.objectStoreNames.contains(STORE_NAME)) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
    }
  } catch (e) {}
}

export function getAllVideos(): VideoItem[] {
  return [...DEFAULT_VIDEOS, ...inMemoryCustomVideos];
}

export function saveCustomVideo(video: Omit<VideoItem, 'id' | 'isBuiltIn'>): VideoItem {
  const newItem: VideoItem = {
    ...video,
    id: `custom-video-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    isBuiltIn: false,
  };

  inMemoryCustomVideos = [newItem, ...inMemoryCustomVideos.filter(v => v.id !== newItem.id)];
  persistVideoToIndexedDB(newItem);

  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_VIDEOS, JSON.stringify(inMemoryCustomVideos));
  } catch (e) {}

  notifyVideoChanges();
  return newItem;
}

export function deleteCustomVideo(id: string): void {
  inMemoryCustomVideos = inMemoryCustomVideos.filter(v => v.id !== id);
  deleteVideoFromIndexedDB(id);

  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_VIDEOS, JSON.stringify(inMemoryCustomVideos));
  } catch (e) {}

  notifyVideoChanges();
}

export function getGlobalVideoConfig(): VideoPlayerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GLOBAL_VIDEO);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

export function setGlobalVideoConfig(config: Partial<VideoPlayerConfig>): void {
  const current = getGlobalVideoConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(STORAGE_KEY_GLOBAL_VIDEO, JSON.stringify(updated));
    notifyVideoChanges();
  } catch (e) {}
}

export function getScreenVideoConfig(screenId: number): VideoPlayerConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_SCREEN_VIDEO_PREFIX}${screenId}`);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {}
  return getGlobalVideoConfig();
}

export function setScreenVideoConfig(screenId: number, config: Partial<VideoPlayerConfig>): void {
  const current = getScreenVideoConfig(screenId);
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(`${STORAGE_KEY_SCREEN_VIDEO_PREFIX}${screenId}`, JSON.stringify(updated));
    notifyVideoChanges();
  } catch (e) {}
}

export function subscribeToVideoChanges(callback: (config: VideoPlayerConfig) => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEY_GLOBAL_VIDEO ||
      e.key?.startsWith(STORAGE_KEY_SCREEN_VIDEO_PREFIX) ||
      e.key === STORAGE_KEY_CUSTOM_VIDEOS ||
      e.key === 'promptify_video_realtime_trigger'
    ) {
      callback(getGlobalVideoConfig());
    }
  };

  const handleCustom = () => {
    callback(getGlobalVideoConfig());
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('promptify_video_update', handleCustom);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('promptify_video_update', handleCustom);
  };
}

function notifyVideoChanges() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('promptify_video_update'));
    try {
      localStorage.setItem('promptify_video_realtime_trigger', Date.now().toString());
    } catch (e) {}
  }
}
