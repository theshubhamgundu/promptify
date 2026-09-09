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

export function getAllVideos(): VideoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_VIDEOS);
    if (raw) {
      const custom: VideoItem[] = JSON.parse(raw);
      return [...DEFAULT_VIDEOS, ...custom];
    }
  } catch (e) {}
  return [...DEFAULT_VIDEOS];
}

export function saveCustomVideo(video: Omit<VideoItem, 'id' | 'isBuiltIn'>): VideoItem {
  const allCustom: VideoItem[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_VIDEOS);
    if (raw) {
      allCustom.push(...JSON.parse(raw));
    }
  } catch (e) {}

  const newItem: VideoItem = {
    ...video,
    id: `custom-video-${Date.now()}`,
    isBuiltIn: false,
  };

  allCustom.unshift(newItem);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_VIDEOS, JSON.stringify(allCustom));
    notifyVideoChanges();
  } catch (e) {}

  return newItem;
}

export function deleteCustomVideo(id: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_VIDEOS);
    if (raw) {
      const custom: VideoItem[] = JSON.parse(raw);
      const filtered = custom.filter(v => v.id !== id);
      localStorage.setItem(STORAGE_KEY_CUSTOM_VIDEOS, JSON.stringify(filtered));
      notifyVideoChanges();
    }
  } catch (e) {}
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
    broadcastVideoUpdate(updated);
  } catch (e) {}
}

export function getScreenVideoConfig(screenId: number): VideoPlayerConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_SCREEN_VIDEO_PREFIX}${screenId}`);
    if (raw) return { ...getGlobalVideoConfig(), ...JSON.parse(raw) };
  } catch (e) {}
  return getGlobalVideoConfig();
}

export function setScreenVideoConfig(screenId: number, config: Partial<VideoPlayerConfig>): void {
  const current = getScreenVideoConfig(screenId);
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(`${STORAGE_KEY_SCREEN_VIDEO_PREFIX}${screenId}`, JSON.stringify(updated));
    broadcastVideoUpdate(updated, screenId);
  } catch (e) {}
}

const subscribers: Set<(config: VideoPlayerConfig, screenId?: number) => void> = new Set();

export function subscribeToVideoChanges(callback: (config: VideoPlayerConfig, screenId?: number) => void): () => void {
  subscribers.add(callback);

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

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('promptify_video_sync');
    bc.onmessage = (event) => {
      if (event.data?.type === 'VIDEO_UPDATE') {
        callback(event.data.config, event.data.screenId);
      }
    };
  } catch (e) {}

  window.addEventListener('storage', handleStorage);

  return () => {
    subscribers.delete(callback);
    window.removeEventListener('storage', handleStorage);
    if (bc) bc.close();
  };
}

function notifyVideoChanges() {
  const cfg = getGlobalVideoConfig();
  subscribers.forEach(cb => cb(cfg));
}

function broadcastVideoUpdate(config: VideoPlayerConfig, screenId?: number) {
  try {
    const bc = new BroadcastChannel('promptify_video_sync');
    bc.postMessage({ type: 'VIDEO_UPDATE', config, screenId, timestamp: Date.now() });
    setTimeout(() => bc.close(), 100);
  } catch (e) {}

  try {
    localStorage.setItem('promptify_video_realtime_trigger', Date.now().toString());
  } catch (e) {}

  notifyVideoChanges();
}
