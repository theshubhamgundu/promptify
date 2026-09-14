export interface TemplateBackground {
  id: string;
  name: string;
  description: string;
  url: string; // File path, SVG data URL, custom base64 image, or external URL
  category: 'pop-art' | 'dark' | 'celebration' | 'alert' | 'minimal' | 'custom';
  textColor: 'dark' | 'light'; // Guides typography contrast: 'dark' for dark text on light bg, 'light' for white text on dark bg
  isBuiltIn?: boolean;
  accentColor?: string;
}

// Built-in high-fidelity styled asset templates
const BUILTIN_BACKGROUNDS: TemplateBackground[] = [
  {
    id: 'pop-art-retro',
    name: 'Pop-Art Retro Classic',
    description: 'Yellow halftone comic dots with bold black pop-art borders (Default)',
    url: '/assets/announcement_template.png',
    category: 'pop-art',
    textColor: 'dark',
    isBuiltIn: true,
    accentColor: '#f59e0b',
  },
  {
    id: 'timer-retro',
    name: '40-Min Timer Canvas',
    description: 'Official countdown timer canvas with retro badge styling',
    url: '/assets/timer_template.png',
    category: 'pop-art',
    textColor: 'dark',
    isBuiltIn: true,
    accentColor: '#9333ea',
  },
];

const CUSTOM_BACKGROUNDS_KEY = 'promptify_custom_backgrounds';
const GLOBAL_DEFAULT_BG_KEY = 'promptify_global_default_bg';
const BG_SYNC_CHANNEL_NAME = 'promptify_background_sync_channel';

// ── Persistent IndexedDB Storage Layer ──────────────────────────────────────
// Prevents storage quota errors and persists backgrounds across sessions and reloads
const DB_NAME = 'promptify_assets_db';
const DB_VERSION = 1;
const STORE_NAME = 'backgrounds';

let inMemoryCustomBackgrounds: TemplateBackground[] = [];
let isDbInitialized = false;

function openAssetsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initialize memory from localStorage first (for instant synchronous render)
try {
  const saved = localStorage.getItem(CUSTOM_BACKGROUNDS_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) inMemoryCustomBackgrounds = parsed;
  }
} catch (e) {}

// Async hydrate from IndexedDB
export async function initBackgroundStorage(): Promise<TemplateBackground[]> {
  try {
    const db = await openAssetsDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getAllReq = store.getAll();

    return new Promise((resolve) => {
      getAllReq.onsuccess = () => {
        const idbBgs: TemplateBackground[] = getAllReq.result || [];
        if (idbBgs.length > 0) {
          // Merge with any in-memory items
          const map = new Map<string, TemplateBackground>();
          idbBgs.forEach(b => map.set(b.id, b));
          inMemoryCustomBackgrounds.forEach(b => map.set(b.id, b));
          inMemoryCustomBackgrounds = Array.from(map.values());
        } else if (inMemoryCustomBackgrounds.length > 0) {
          // Seed IndexedDB from localStorage if empty
          persistAllToIndexedDB(inMemoryCustomBackgrounds);
        }
        isDbInitialized = true;
        broadcastBgChange({ type: 'BACKGROUND_LIST_CHANGED' });
        resolve([...inMemoryCustomBackgrounds, ...BUILTIN_BACKGROUNDS]);
      };
      getAllReq.onerror = () => {
        resolve([...inMemoryCustomBackgrounds, ...BUILTIN_BACKGROUNDS]);
      };
    });
  } catch (e) {
    return [...inMemoryCustomBackgrounds, ...BUILTIN_BACKGROUNDS];
  }
}

// Automatically initiate hydration on script load
if (typeof window !== 'undefined') {
  initBackgroundStorage();
}

async function persistToIndexedDB(bg: TemplateBackground): Promise<void> {
  try {
    const db = await openAssetsDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bg);
  } catch (e) {
    console.warn('Could not persist background to IndexedDB:', e);
  }
}

async function deleteFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openAssetsDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {
    console.warn('Could not delete background from IndexedDB:', e);
  }
}

async function persistAllToIndexedDB(bgs: TemplateBackground[]): Promise<void> {
  try {
    const db = await openAssetsDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    bgs.forEach(bg => store.put(bg));
  } catch (e) {}
}

// ── Get all backgrounds (Built-in + Custom) ──────────────────────────────────
export function getAllBackgrounds(): TemplateBackground[] {
  // Return in-memory list (fast + complete) + builtins
  return [...inMemoryCustomBackgrounds, ...BUILTIN_BACKGROUNDS];
}

// ── Get background by ID or URL ──────────────────────────────────────────────
export function getBackgroundById(idOrUrl?: string): TemplateBackground {
  if (!idOrUrl) return BUILTIN_BACKGROUNDS[0];
  const all = getAllBackgrounds();
  const found = all.find(b => b.id === idOrUrl || b.url === idOrUrl);
  if (found) return found;

  // If it's a direct URL that doesn't match an ID, return dynamic wrapper
  if (idOrUrl.startsWith('http') || idOrUrl.startsWith('data:') || idOrUrl.startsWith('/')) {
    return {
      id: 'custom-url',
      name: 'Custom Applied Background',
      description: 'Custom background URL',
      url: idOrUrl,
      category: 'custom',
      textColor: 'dark',
      isBuiltIn: false,
    };
  }

  return BUILTIN_BACKGROUNDS[0];
}

// ── Save custom background ───────────────────────────────────────────────────
export function saveCustomBackground(bg: Omit<TemplateBackground, 'id'>): TemplateBackground {
  const newBg: TemplateBackground = {
    ...bg,
    id: `custom-bg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    isBuiltIn: false,
    category: bg.category || 'custom',
  };

  // 1. Instantly update in-memory cache
  inMemoryCustomBackgrounds = [newBg, ...inMemoryCustomBackgrounds.filter(b => b.id !== newBg.id)];

  // 2. Persist permanently to IndexedDB (unlimited quota)
  persistToIndexedDB(newBg);

  // 3. Attempt localStorage mirror (best effort, ignore quota errors)
  try {
    localStorage.setItem(CUSTOM_BACKGROUNDS_KEY, JSON.stringify(inMemoryCustomBackgrounds));
  } catch (e) {
    console.info('LocalStorage quota exceeded; safely stored in persistent IndexedDB storage.');
  }

  // 4. Notify all screens & listeners
  broadcastBgChange({ type: 'BACKGROUND_LIST_CHANGED' });

  return newBg;
}

// ── Delete custom background ─────────────────────────────────────────────────
export function deleteCustomBackground(id: string): void {
  // 1. Remove from in-memory cache
  inMemoryCustomBackgrounds = inMemoryCustomBackgrounds.filter(b => b.id !== id);

  // 2. Delete from IndexedDB
  deleteFromIndexedDB(id);

  // 3. Mirror in localStorage
  try {
    localStorage.setItem(CUSTOM_BACKGROUNDS_KEY, JSON.stringify(inMemoryCustomBackgrounds));
  } catch (e) {}

  // 4. Notify listeners
  broadcastBgChange({ type: 'BACKGROUND_LIST_CHANGED' });
}

// ── Get only custom uploaded backgrounds ─────────────────────────────────────
export function getCustomBackgrounds(): TemplateBackground[] {
  return inMemoryCustomBackgrounds;
}

// ── Global Default Background ────────────────────────────────────────────────
export function getGlobalDefaultBackground(): string {
  try {
    const saved = localStorage.getItem(GLOBAL_DEFAULT_BG_KEY);
    if (saved) return saved;
  } catch {}
  return '/assets/announcement_template.png';
}

export function setGlobalDefaultBackground(bgUrlOrId: string): void {
  try {
    localStorage.setItem(GLOBAL_DEFAULT_BG_KEY, bgUrlOrId);
    broadcastBgChange({ type: 'GLOBAL_BG_CHANGED', bgUrl: bgUrlOrId });
  } catch (e) {
    console.warn('Error setting global default background:', e);
  }
}

// ── Screen-Specific Background Overrides ──────────────────────────────────────
export function getScreenBackground(screenId: number): string {
  try {
    const saved = localStorage.getItem(`promptify_screen_${screenId}_bg`);
    if (saved) return saved;
  } catch {}
  return getGlobalDefaultBackground();
}

export function setScreenBackground(screenId: number, bgUrlOrId: string): void {
  try {
    localStorage.setItem(`promptify_screen_${screenId}_bg`, bgUrlOrId);
    broadcastBgChange({ type: 'SCREEN_BG_CHANGED', screenId, bgUrl: bgUrlOrId });
  } catch (e) {
    console.warn('Error setting screen background:', e);
  }
}

// ── Realtime Broadcast Sync ──────────────────────────────────────────────────
function broadcastBgChange(message: any) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BG_SYNC_CHANNEL_NAME);
      bc.postMessage(message);
      bc.close();
    }
  } catch (e) {}
}

export function subscribeToBackgroundChanges(
  onBackgroundChange: (event: any) => void
): () => void {
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(BG_SYNC_CHANNEL_NAME);
    bc.onmessage = (e) => {
      if (e.data) onBackgroundChange(e.data);
    };
  }

  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === CUSTOM_BACKGROUNDS_KEY ||
      e.key === GLOBAL_DEFAULT_BG_KEY ||
      (e.key && e.key.startsWith('promptify_screen_') && e.key.endsWith('_bg'))
    ) {
      onBackgroundChange({ type: 'STORAGE_EVENT', key: e.key, newValue: e.newValue });
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (bc) bc.close();
    window.removeEventListener('storage', handleStorage);
  };
}
