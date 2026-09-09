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

// ── Get all backgrounds (Built-in + Custom) ──────────────────────────────────
export function getAllBackgrounds(): TemplateBackground[] {
  try {
    const saved = localStorage.getItem(CUSTOM_BACKGROUNDS_KEY);
    if (saved) {
      const parsed: TemplateBackground[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return [...parsed, ...BUILTIN_BACKGROUNDS];
      }
    }
  } catch (e) {
    console.warn('Error reading custom backgrounds:', e);
  }
  return [...BUILTIN_BACKGROUNDS];
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

  try {
    const existing = getCustomBackgrounds();
    const updated = [newBg, ...existing];
    localStorage.setItem(CUSTOM_BACKGROUNDS_KEY, JSON.stringify(updated));
    broadcastBgChange({ type: 'BACKGROUND_LIST_CHANGED' });
  } catch (e) {
    console.error('Error saving custom background:', e);
  }

  return newBg;
}

// ── Delete custom background ─────────────────────────────────────────────────
export function deleteCustomBackground(id: string): void {
  try {
    const existing = getCustomBackgrounds();
    const updated = existing.filter(b => b.id !== id);
    localStorage.setItem(CUSTOM_BACKGROUNDS_KEY, JSON.stringify(updated));
    broadcastBgChange({ type: 'BACKGROUND_LIST_CHANGED' });
  } catch (e) {
    console.error('Error deleting custom background:', e);
  }
}

// ── Get only custom uploaded backgrounds ─────────────────────────────────────
export function getCustomBackgrounds(): TemplateBackground[] {
  try {
    const saved = localStorage.getItem(CUSTOM_BACKGROUNDS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
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
