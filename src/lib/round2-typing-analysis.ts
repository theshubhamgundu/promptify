/**
 * Round 2: Typing Behavior Analysis
 * 
 * Tracks keystroke patterns to detect copy-paste attempts, AI assistance,
 * or other anomalous behavior without informing participants.
 */

export interface KeystrokeEvent {
  key: string;
  timestamp: number;
  type: 'keydown' | 'keyup' | 'input';
  textLength: number;
  charDelta?: number; // How many characters changed in this event
}

export interface TypingMetrics {
  totalCharacters: number;
  totalTypingDurationMs: number;
  averageWPM: number;
  pauseCount: number; // Pauses > 3 seconds
  longPauses: number[]; // Array of pause durations > 3s
  burstEvents: number; // Times >15 chars appeared in <500ms
  backspaceCount: number;
  correctionRate: number; // Backspaces per 100 characters
  keystrokeLog: KeystrokeEvent[];
  suspiciousPatterns: string[]; // Descriptions of suspicious behavior
}

export interface TypingBehaviorScore {
  score: number; // Out of 10
  flags: string[]; // Issues detected (for admin review only)
  metrics: TypingMetrics;
}

/**
 * Analyze typing behavior from keystroke log
 */
export function analyzeTypingBehavior(
  keystrokeLog: KeystrokeEvent[],
  finalText: string
): TypingBehaviorScore {
  
  if (keystrokeLog.length === 0) {
    return {
      score: 0,
      flags: ['No keystroke data recorded - possible bypass'],
      metrics: {
        totalCharacters: finalText.length,
        totalTypingDurationMs: 0,
        averageWPM: 0,
        pauseCount: 0,
        longPauses: [],
        burstEvents: 0,
        backspaceCount: 0,
        correctionRate: 0,
        keystrokeLog: [],
        suspiciousPatterns: []
      }
    };
  }

  const metrics = calculateTypingMetrics(keystrokeLog, finalText);
  const flags: string[] = [];
  let score = 10; // Start with full score

  // 1. Check for text bursts (>15 chars in one event)
  if (metrics.burstEvents > 0) {
    flags.push(`${metrics.burstEvents} burst event(s) detected (>15 chars in <500ms)`);
    score -= Math.min(4, metrics.burstEvents * 2); // -2 per burst, max -4
  }

  // 2. Check typing speed
  if (metrics.averageWPM > 200) {
    flags.push(`Unusually high typing speed: ${metrics.averageWPM.toFixed(0)} WPM`);
    score -= 3;
  } else if (metrics.averageWPM > 150) {
    flags.push(`Very fast typing: ${metrics.averageWPM.toFixed(0)} WPM`);
    score -= 1;
  }

  // 3. Check for unnaturally low correction rate on long text
  if (finalText.length > 100 && metrics.correctionRate < 0.5) {
    flags.push(`Unusually low correction rate: ${metrics.correctionRate.toFixed(1)}% (perfect-first-try signal)`);
    score -= 1; // Soft signal only
  }

  // 4. Check for extremely unnatural patterns
  if (metrics.totalCharacters > 50 && metrics.totalTypingDurationMs < 5000) {
    flags.push(`Text appeared too fast: ${metrics.totalCharacters} chars in ${(metrics.totalTypingDurationMs / 1000).toFixed(1)}s`);
    score -= 3;
  }

  // 5. No natural pauses on long text (>200 chars)
  if (finalText.length > 200 && metrics.pauseCount === 0) {
    flags.push('No thinking pauses detected on long prompt (unusual)');
    score -= 1;
  }

  return {
    score: Math.max(0, score),
    flags,
    metrics
  };
}

/**
 * Calculate detailed typing metrics
 */
function calculateTypingMetrics(
  keystrokeLog: KeystrokeEvent[],
  finalText: string
): TypingMetrics {
  
  let backspaceCount = 0;
  let burstEvents = 0;
  const pauseDurations: number[] = [];
  let totalTypingTime = 0;

  // Sort by timestamp
  const sortedLog = [...keystrokeLog].sort((a, b) => a.timestamp - b.timestamp);
  
  if (sortedLog.length === 0) {
    return {
      totalCharacters: finalText.length,
      totalTypingDurationMs: 0,
      averageWPM: 0,
      pauseCount: 0,
      longPauses: [],
      burstEvents: 0,
      backspaceCount: 0,
      correctionRate: 0,
      keystrokeLog: sortedLog,
      suspiciousPatterns: []
    };
  }

  const startTime = sortedLog[0].timestamp;
  const endTime = sortedLog[sortedLog.length - 1].timestamp;
  totalTypingTime = endTime - startTime;

  // Analyze keystroke patterns
  for (let i = 0; i < sortedLog.length; i++) {
    const event = sortedLog[i];
    
    // Count backspaces
    if (event.key === 'Backspace') {
      backspaceCount++;
    }

    // Detect bursts (large character delta in short time)
    if (event.charDelta && event.charDelta > 15) {
      burstEvents++;
    }

    // Detect pauses (>3 seconds between keystrokes)
    if (i > 0) {
      const timeDiff = event.timestamp - sortedLog[i - 1].timestamp;
      if (timeDiff > 3000) {
        pauseDurations.push(timeDiff);
      }
    }
  }

  // Calculate WPM (assuming average word = 5 characters)
  const words = finalText.length / 5;
  const minutes = totalTypingTime / 60000;
  const averageWPM = minutes > 0 ? words / minutes : 0;

  // Calculate correction rate (backspaces per 100 chars)
  const correctionRate = finalText.length > 0 
    ? (backspaceCount / finalText.length) * 100 
    : 0;

  return {
    totalCharacters: finalText.length,
    totalTypingDurationMs: totalTypingTime,
    averageWPM,
    pauseCount: pauseDurations.length,
    longPauses: pauseDurations,
    burstEvents,
    backspaceCount,
    correctionRate,
    keystrokeLog: sortedLog,
    suspiciousPatterns: []
  };
}

/**
 * Create a keystroke tracker for a textarea
 */
export function createKeystrokeTracker() {
  const log: KeystrokeEvent[] = [];
  let lastTextLength = 0;

  const trackKeyDown = (e: KeyboardEvent, currentText: string) => {
    const charDelta = currentText.length - lastTextLength;
    
    log.push({
      key: e.key,
      timestamp: Date.now(),
      type: 'keydown',
      textLength: currentText.length,
      charDelta: Math.abs(charDelta)
    });
    
    lastTextLength = currentText.length;
  };

  const trackInput = (currentText: string) => {
    const charDelta = currentText.length - lastTextLength;
    
    // Large char delta = possible paste/burst
    if (Math.abs(charDelta) > 15) {
      log.push({
        key: 'INPUT_BURST',
        timestamp: Date.now(),
        type: 'input',
        textLength: currentText.length,
        charDelta: Math.abs(charDelta)
      });
    }
    
    lastTextLength = currentText.length;
  };

  const getLog = () => log;
  const reset = () => {
    log.length = 0;
    lastTextLength = 0;
  };

  return { trackKeyDown, trackInput, getLog, reset };
}
