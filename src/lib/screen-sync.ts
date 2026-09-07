export type DisplayPageType = 'announcements' | 'leaderboard' | 'rounds' | 'results' | 'rules';

export interface ScreenInfo {
  id: number;
  label: string;
  defaultPage: DisplayPageType;
}

export interface ScreenAnnouncement {
  id?: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  pinned?: boolean;
}

export const ALL_SCREENS: ScreenInfo[] = [
  { id: 1, label: 'Screen 1', defaultPage: 'announcements' },
  { id: 2, label: 'Screen 2', defaultPage: 'leaderboard' },
  { id: 3, label: 'Screen 3', defaultPage: 'rounds' },
  { id: 4, label: 'Screen 4', defaultPage: 'results' },
  { id: 5, label: 'Screen 5', defaultPage: 'rules' },
];

export const DISPLAY_PAGES: { id: DisplayPageType; label: string; icon: string; desc: string; preview: string }[] = [
  { id: 'announcements', label: 'Announcements', icon: '📢', desc: 'Live Pop-Art Broadcast Banners with urgent sound chime', preview: 'Displays screen-specific live broadcast announcements, urgent flashes, and countdown titles.' },
  { id: 'leaderboard', label: 'Live Leaderboard', icon: '🏆', desc: 'Real-time competition scoreboard & podium', preview: 'Displays the Top 3 champions podium and animated real-time team standings.' },
  { id: 'rounds', label: 'Rounds & Timers', icon: '⏱️', desc: 'Active competition phases & countdown timers', preview: 'Displays round timeline, active challenge indicators, and time limits.' },
  { id: 'results', label: 'Final Awards & Podium', icon: '🎖️', desc: 'Championship reveal and winner showcase', preview: 'Grand celebration podium revealing 1st, 2nd, and 3rd place winners.' },
  { id: 'rules', label: 'Rules & Guidelines', icon: '📋', desc: 'Event regulations & submission rules', preview: 'Displays workstation rules, allowed AI policies, and code of conduct.' },
];

export const DEFAULT_SCREEN_ANNOUNCEMENTS: Record<number, ScreenAnnouncement> = {
  1: {
    id: 'def-ann-1',
    title: 'STARTS IN 10 MINS',
    message: 'Please take your seats and prepare your workstations. Contest Round 1 is starting shortly!',
    priority: 'URGENT',
    pinned: true,
  },
  2: {
    id: 'def-ann-2',
    title: 'ROUND 1 IN PROGRESS',
    message: 'AI + Tech Challenge is now live. 30 minutes remaining. Good luck contenders!',
    priority: 'IMPORTANT',
    pinned: true,
  },
  3: {
    id: 'def-ann-3',
    title: '5 MINUTES REMAINING',
    message: 'Final countdown! Please review and submit your work before the timer reaches zero.',
    priority: 'URGENT',
    pinned: true,
  },
  4: {
    id: 'def-ann-4',
    title: 'INTERMISSION / BREAK',
    message: 'Round complete! Next challenge briefing will start in 15 minutes. Refreshments in foyer.',
    priority: 'NORMAL',
    pinned: false,
  },
  5: {
    id: 'def-ann-5',
    title: 'FINAL EVALUATION LOCKED',
    message: 'All submissions evaluated by the jury. Prepare for the grand championship awards ceremony!',
    priority: 'IMPORTANT',
    pinned: true,
  },
};

export const ANNOUNCEMENT_PRESETS: ScreenAnnouncement[] = [
  {
    title: 'STARTS IN 10 MINS',
    message: 'Please take your seats and prepare your workstations. Contest Round 1 is starting shortly!',
    priority: 'URGENT',
    pinned: true,
  },
  {
    title: 'ROUND 1 IN PROGRESS',
    message: 'AI + Tech Challenge is now live. 30 minutes remaining. Good luck contenders!',
    priority: 'IMPORTANT',
    pinned: true,
  },
  {
    title: 'ROUND 2: PROMPT HEIST',
    message: 'Prompt Heist is active. Precision and token efficiency are being measured!',
    priority: 'IMPORTANT',
    pinned: true,
  },
  {
    title: '5 MINUTES REMAINING',
    message: 'Final countdown! Please review and submit your work before the timer reaches zero.',
    priority: 'URGENT',
    pinned: true,
  },
  {
    title: 'INTERMISSION / BREAK',
    message: 'Round complete! Next challenge briefing will start in 15 minutes.',
    priority: 'NORMAL',
    pinned: false,
  },
  {
    title: 'SUBMISSION DEADLINE CLOSED',
    message: 'Time has expired. All submissions are now undergoing automated judge evaluation.',
    priority: 'URGENT',
    pinned: true,
  },
  {
    title: 'FINAL AWARDS CEREMONY',
    message: 'Prepare for the grand champion reveal and trophy distribution!',
    priority: 'IMPORTANT',
    pinned: true,
  },
];

const CUSTOM_TEMPLATES_KEY = 'promptify_custom_templates';

export function getCustomTemplates(): ScreenAnnouncement[] {
  try {
    const saved = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveCustomTemplate(template: ScreenAnnouncement): ScreenAnnouncement[] {
  const existing = getCustomTemplates();
  const filtered = existing.filter(t => t.title !== template.title);
  const updated = [template, ...filtered];
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteCustomTemplate(title: string): ScreenAnnouncement[] {
  const existing = getCustomTemplates();
  const updated = existing.filter(t => t.title !== title);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
  return updated;
}

export function getAllTemplates(): ScreenAnnouncement[] {
  const custom = getCustomTemplates();
  const customTitles = new Set(custom.map(c => c.title));
  const builtIn = ANNOUNCEMENT_PRESETS.filter(p => !customTitles.has(p.title));
  return [...custom, ...builtIn];
}

const BROADCAST_CHANNEL_NAME = 'promptify_screen_sync_channel';

// ── Screen Page Assignment ───────────────────────────────────────────────
export function getScreenPage(screenId: number): DisplayPageType {
  try {
    const saved = localStorage.getItem(`promptify_screen_${screenId}_page`);
    if (saved && DISPLAY_PAGES.some(p => p.id === saved)) {
      return saved as DisplayPageType;
    }
  } catch {}
  const match = ALL_SCREENS.find(s => s.id === screenId);
  return match?.defaultPage || 'announcements';
}

export function setScreenPage(screenId: number, page: DisplayPageType) {
  try {
    localStorage.setItem(`promptify_screen_${screenId}_page`, page);
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'SCREEN_PAGE_CHANGE', screenId, page });
      bc.close();
    }
  } catch (e) {
    console.warn('Error saving screen page:', e);
  }
}

// ── Screen Announcement Assignment ───────────────────────────────────────
export function getScreenAnnouncement(screenId: number): ScreenAnnouncement {
  try {
    const saved = localStorage.getItem(`promptify_screen_${screenId}_announcement`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.title) return parsed;
    }
  } catch {}
  return DEFAULT_SCREEN_ANNOUNCEMENTS[screenId] || DEFAULT_SCREEN_ANNOUNCEMENTS[1];
}

export function setScreenAnnouncement(screenId: number, announcement: ScreenAnnouncement) {
  try {
    localStorage.setItem(`promptify_screen_${screenId}_announcement`, JSON.stringify(announcement));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'SCREEN_ANNOUNCEMENT_CHANGE', screenId, announcement });
      bc.close();
    }
  } catch (e) {
    console.warn('Error saving screen announcement:', e);
  }
}

// ── Realtime Event Listeners ─────────────────────────────────────────────
export function subscribeToScreenChanges(
  onPageChange: (screenId: number, page: DisplayPageType) => void,
  onAnnouncementChange?: (screenId: number, announcement: ScreenAnnouncement) => void
) {
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (event.data) {
        if (event.data.type === 'SCREEN_PAGE_CHANGE') {
          onPageChange(event.data.screenId, event.data.page);
        } else if (event.data.type === 'SCREEN_ANNOUNCEMENT_CHANGE' && onAnnouncementChange) {
          onAnnouncementChange(event.data.screenId, event.data.announcement);
        }
      }
    };
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key && e.newValue) {
      if (e.key.startsWith('promptify_screen_') && e.key.endsWith('_page')) {
        const match = e.key.match(/promptify_screen_(\d+)_page/);
        if (match && match[1]) {
          onPageChange(parseInt(match[1], 10), e.newValue as DisplayPageType);
        }
      } else if (e.key.startsWith('promptify_screen_') && e.key.endsWith('_announcement') && onAnnouncementChange) {
        const match = e.key.match(/promptify_screen_(\d+)_announcement/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed) onAnnouncementChange(parseInt(match[1], 10), parsed);
          } catch {}
        }
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (bc) bc.close();
    window.removeEventListener('storage', handleStorage);
  };
}
