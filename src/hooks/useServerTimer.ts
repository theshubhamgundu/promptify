import { useState, useEffect } from 'react';

export function useServerTimer(endTimeStr: string | null) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!endTimeStr) return;
    const endTime = new Date(endTimeStr).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setSeconds(diff);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [endTimeStr]);

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

export function useServerCountdown(endTimeStr: string | null, totalSeconds: number, onEnd?: () => void) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || !endTimeStr) return;
    const endTime = new Date(endTimeStr).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      
      if (diff <= 0) {
        setSeconds(0);
        setRunning(false);
        onEnd?.();
      } else {
        setSeconds(diff);
      }
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [endTimeStr, running, onEnd]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;

  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    total: seconds,
    percent: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
  };
}
