import { supabase } from './supabase';

export type ActivityAction =
  | 'LOGIN_ATTEMPT'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'VERIFICATION_REQUESTED'
  | 'VERIFICATION_APPROVED'
  | 'ROUND_STARTED'
  | 'ROUND_COMPLETED'
  | 'SUBMISSION_CREATED'
  | 'SUBMISSION_EVALUATED'
  | 'HINT_USED'
  | 'TAB_SWITCH'
  | 'COPY_PASTE_DETECTED'
  | 'FOCUS_LOST'
  | 'FOCUS_REGAINED'
  | 'IDLE_DETECTED'
  | 'RAPID_SUBMISSION'
  | 'SCORE_OVERRIDE'
  | 'SESSION_EXPIRED'
  | 'RECONNECTED'
  | 'OFFLINE_QUEUE_FLUSHED'
  | 'UNAUTHORIZED_EXTENSION';

interface LogEntry {
  action: ActivityAction;
  teamId?: string;
  userId?: string;
  details?: Record<string, any>;
}

// In-memory buffer for batching logs
let logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER = 20;

export class IntegrityMonitor {
  private static tabSwitchCount = 0;
  private static copyPasteCount = 0;
  private static lastSubmissionTime = 0;
  private static idleTimeout: ReturnType<typeof setTimeout> | null = null;
  private static initialized = false;

  private static violationCallback: ((reason: string) => void) | null = null;

  /**
   * Initialize the integrity monitor. Call once from App.tsx.
   * Sets up passive listeners for tab switches, copy/paste, idle detection.
   */
  static init(teamId?: string, onViolation?: (reason: string) => void) {
    // TEMPORARILY DISABLED - Database timeouts causing app to fail
    console.log('[IntegrityMonitor] Temporarily disabled due to database timeout issues');
    this.initialized = true;
    return;
    
    if (this.initialized) {
      if (onViolation) this.violationCallback = onViolation;
      return;
    }
    this.initialized = true;
    if (onViolation) this.violationCallback = onViolation;

    // ── Tab visibility changes ──
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.tabSwitchCount++;
        this.log({
          action: 'TAB_SWITCH',
          teamId,
          details: { count: this.tabSwitchCount, timestamp: Date.now() }
        });
      }
    });

    // ── Focus loss/regain ──
    window.addEventListener('blur', () => {
      this.log({
        action: 'FOCUS_LOST',
        teamId,
        details: { timestamp: Date.now() }
      });
    });

    window.addEventListener('focus', () => {
      this.log({
        action: 'FOCUS_REGAINED',
        teamId,
        details: { timestamp: Date.now() }
      });
      this.resetIdleTimer(teamId);
    });

    // ── Copy/paste detection ──
    document.addEventListener('copy', () => {
      this.copyPasteCount++;
      this.log({
        action: 'COPY_PASTE_DETECTED',
        teamId,
        details: { type: 'copy', count: this.copyPasteCount }
      });
    });

    document.addEventListener('paste', () => {
      this.copyPasteCount++;
      this.log({
        action: 'COPY_PASTE_DETECTED',
        teamId,
        details: { type: 'paste', count: this.copyPasteCount }
      });
    });

    // ── Idle detection (5 min inactivity) ──
    const resetEvents = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    resetEvents.forEach(evt => {
      document.addEventListener(evt, () => this.resetIdleTimer(teamId), { passive: true });
    });
    this.resetIdleTimer(teamId);

    // ── Start flush timer ──
    this.startFlushTimer();

    // ── Extension Detection (DOM Mutation) ──
    this.setupExtensionDetector(teamId);

    // ── Prevent Inspect Element / Dev Tools ──
    this.setupAntiInspect();

    console.log('[IntegrityMonitor] Initialized');
  }

  private static setupAntiInspect() {
    // TEMPORARILY DISABLED FOR DEBUGGING
    console.log('[IntegrityMonitor] Anti-inspect temporarily disabled for debugging');
    return;
    
    // Disable right click
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Disable common dev tools shortcuts
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
      }
    });
  }

  private static setupExtensionDetector(teamId?: string) {
    const knownExtensionTags = ['GRAMMARLY-EXTENSION', 'GEMINI-EXTENSION', 'MONICA-EXTENSION', 'BING-CHAT-EXTENSION'];
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const tagName = node.tagName.toUpperCase();
            
            // Check known tags
            if (knownExtensionTags.some(tag => tagName.includes(tag)) || 
                node.id.toLowerCase().includes('extension') || 
                node.className.toString().toLowerCase().includes('grammarly')) {
              
              this.log({
                action: 'UNAUTHORIZED_EXTENSION',
                teamId,
                details: { detectedNode: tagName, id: node.id }
              });
              
              // Trigger strict blocking
              if (this.violationCallback) {
                this.violationCallback(`Unauthorized browser extension detected: ${tagName}`);
              }
              
              // Try to remove it to enforce strict environment
              try { node.remove(); } catch(e) {}
            }
          }
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check for rapid submissions (anti-spam).
   * Returns true if the submission is suspicious.
   */
  static checkRapidSubmission(teamId?: string): boolean {
    const now = Date.now();
    const elapsed = now - this.lastSubmissionTime;
    this.lastSubmissionTime = now;

    // Less than 3 seconds between submissions is suspicious
    if (elapsed > 0 && elapsed < 3000) {
      this.log({
        action: 'RAPID_SUBMISSION',
        teamId,
        details: { intervalMs: elapsed }
      });
      return true;
    }
    return false;
  }

  /**
   * Get current integrity stats for display.
   */
  static getStats() {
    return {
      tabSwitches: this.tabSwitchCount,
      copyPasteEvents: this.copyPasteCount,
      pendingLogs: logBuffer.length,
    };
  }

  /**
   * Log an activity. Buffers locally and flushes to Supabase periodically.
   */
  static log(entry: LogEntry) {
    logBuffer.push(entry);

    // Flush immediately if buffer is full
    if (logBuffer.length >= MAX_BUFFER) {
      this.flush();
    }
  }

  /**
   * Force flush all buffered logs to the database.
   */
  static async flush() {
    if (logBuffer.length === 0) return;

    const toFlush = [...logBuffer];
    logBuffer = [];

    const rows = toFlush.map(e => ({
      team_id: e.teamId || null,
      user_id: e.userId || null,
      action: e.action,
      details: e.details || {},
      ip_address: null, // Cannot reliably get client IP from browser
      created_at: new Date().toISOString(),
    }));

    try {
      const { error } = await supabase.from('activity_logs').insert(rows);
      if (error) {
        console.error('[IntegrityMonitor] Flush failed, re-queuing', error);
        // Re-queue failed entries
        logBuffer = [...toFlush, ...logBuffer];
      }
    } catch (err) {
      console.error('[IntegrityMonitor] Flush exception', err);
      logBuffer = [...toFlush, ...logBuffer];
    }
  }

  // ── Private helpers ──

  private static resetIdleTimer(teamId?: string) {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.log({
        action: 'IDLE_DETECTED',
        teamId,
        details: { idleMinutes: 5 }
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  private static startFlushTimer() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL);

    // Also flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }
}
