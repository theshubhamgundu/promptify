export type DisplayPageType = 'announcements' | 'leaderboard' | 'rounds' | 'results' | 'rules' | 'timer';

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
  { id: 'timer', label: '40-Min Round Timer', icon: '⏳', desc: 'Full-screen 40-minute countdown timer', preview: 'Displays a large animated 40-minute countdown timer for each competition round.' },
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

// ── Timer State Sync ─────────────────────────────────────────────────────
export interface TimerState {
  /** Total duration in seconds (default 2400 = 40 mins) */
  duration: number;
  /** ISO timestamp when the timer was started (null if not started) */
  startedAt: string | null;
  /** 'idle' | 'running' | 'paused' | 'finished' */
  status: 'idle' | 'running' | 'paused' | 'finished';
  /** Seconds remaining when paused */
  pausedRemaining: number | null;
}

const TIMER_KEY = 'promptify_timer_state';
const DEFAULT_TIMER: TimerState = {
  duration: 2400,
  startedAt: null,
  status: 'idle',
  pausedRemaining: null,
};

export function getTimerState(): TimerState {
  try {
    const saved = localStorage.getItem(TIMER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.duration) return parsed;
    }
  } catch {}
  return { ...DEFAULT_TIMER };
}

export function setTimerState(state: TimerState) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ type: 'TIMER_STATE_CHANGE', state });
      bc.close();
    }
  } catch (e) {
    console.warn('Error saving timer state:', e);
  }
}

export function startTimer(durationSeconds: number = 2400) {
  setTimerState({
    duration: durationSeconds,
    startedAt: new Date().toISOString(),
    status: 'running',
    pausedRemaining: null,
  });
}

export function pauseTimer() {
  const current = getTimerState();
  if (current.status !== 'running' || !current.startedAt) return;
  const elapsed = (Date.now() - new Date(current.startedAt).getTime()) / 1000;
  const remaining = Math.max(0, current.duration - elapsed);
  setTimerState({
    ...current,
    status: 'paused',
    pausedRemaining: remaining,
  });
}

export function resumeTimer() {
  const current = getTimerState();
  if (current.status !== 'paused' || current.pausedRemaining == null) return;
  const newStartedAt = new Date(Date.now() - (current.duration - current.pausedRemaining) * 1000).toISOString();
  setTimerState({
    ...current,
    status: 'running',
    startedAt: newStartedAt,
    pausedRemaining: null,
  });
}

export function resetTimer(durationSeconds: number = 2400) {
  setTimerState({
    duration: durationSeconds,
    startedAt: null,
    status: 'idle',
    pausedRemaining: null,
  });
}

export function subscribeToTimerChanges(onTimerChange: (state: TimerState) => void) {
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (event.data?.type === 'TIMER_STATE_CHANGE') {
        onTimerChange(event.data.state);
      }
    };
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === TIMER_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed) onTimerChange(parsed);
      } catch {}
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (bc) bc.close();
    window.removeEventListener('storage', handleStorage);
  };
}
