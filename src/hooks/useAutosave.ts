import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAutosave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  delayMs = 1000
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<T>(data);
  const dataRef = useRef(data);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    dataRef.current = data;
    
    if (JSON.stringify(data) !== JSON.stringify(lastSavedData)) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await saveFn(dataRef.current);
          setLastSavedData(dataRef.current);
        } catch (error) {
          console.error("Autosave failed", error);
        } finally {
          setIsSaving(false);
        }
      }, delayMs);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data, lastSavedData, delayMs, saveFn]);

  return { isSaving };
}
