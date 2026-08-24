import { useState, useEffect } from 'react';

export function useTimer(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    total: seconds,
  };
}

export function useCountdown(initialSeconds: number, onEnd?: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) {
      onEnd?.();
      return;
    }
    const id = setInterval(() => setSeconds((s) => {
      if (s <= 1) { setRunning(false); onEnd?.(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [running, seconds, onEnd]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    total: seconds,
    percent: Math.round((seconds / initialSeconds) * 100),
  };
}
