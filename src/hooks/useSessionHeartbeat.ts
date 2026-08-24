import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';

export function useSessionHeartbeat(intervalMs: number = 60000) {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentTeam) return;

    const sendHeartbeat = async () => {
      try {
        await supabase
          .from('team_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('team_id', currentTeam.id);
      } catch (error) {
        console.error('Failed to send heartbeat', error);
      }
    };

    // Send immediate heartbeat on mount
    sendHeartbeat();

    // Set up interval
    timeoutRef.current = setInterval(sendHeartbeat, intervalMs);

    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [currentTeam, intervalMs]);
}
