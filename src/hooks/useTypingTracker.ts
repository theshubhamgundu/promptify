import { useState, useCallback, useRef } from 'react';
import type { KeystrokeEvent } from '../lib/round2-typing-analysis';

export function useTypingTracker() {
  const [keystrokeLog, setKeystrokeLog] = useState<KeystrokeEvent[]>([]);
  const lastTextLength = useRef(0);

  const trackKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, currentText: string) => {
    const charDelta = currentText.length - lastTextLength.current;
    
    setKeystrokeLog(prev => [...prev, {
      key: e.key,
      timestamp: Date.now(),
      type: 'keydown',
      textLength: currentText.length,
      charDelta: Math.abs(charDelta)
    }]);
    
    lastTextLength.current = currentText.length;
  }, []);

  const trackInput = useCallback((currentText: string) => {
    const charDelta = currentText.length - lastTextLength.current;
    
    // Detect large text bursts (>15 chars in one input event)
    if (Math.abs(charDelta) > 15) {
      setKeystrokeLog(prev => [...prev, {
        key: 'INPUT_BURST',
        timestamp: Date.now(),
        type: 'input',
        textLength: currentText.length,
        charDelta: Math.abs(charDelta)
      }]);
    }
    
    lastTextLength.current = currentText.length;
  }, []);

  const resetLog = useCallback(() => {
    setKeystrokeLog([]);
    lastTextLength.current = 0;
  }, []);

  return {
    keystrokeLog,
    trackKeyDown,
    trackInput,
    resetLog
  };
}
