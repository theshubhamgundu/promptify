import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { LeaderboardEngine, type LeaderboardEntry } from '../lib/leaderboard-engine';
import { getScreenAnnouncement } from '../lib/screen-sync';

export interface DisplayAnnouncement {
  id: string;
  event_id?: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  severity?: string;
  pinned: boolean;
  is_active: boolean;
  scheduled_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface LiveEventInfo {
  id: string;
  name: string;
  description?: string;
  status: string;
  start_time?: string;
  end_time?: string;
}

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';

export function useLiveDisplay(screenId: number = 1) {
  const [eventInfo, setEventInfo] = useState<LiveEventInfo | null>(null);
  const [announcements, setAnnouncements] = useState<DisplayAnnouncement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTED');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  
  // Auto-rotation state for featured announcement (10s per slide)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [rotationProgress, setRotationProgress] = useState(0); // 0 to 100%
  const isPausedRef = useRef(false);

  // 1. Fetch active event
  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setEventInfo(data[0]);
        return data[0].id;
      }
    } catch (err) {
      console.warn('Error fetching active event for live display:', err);
    }
    return undefined;
  }, []);

  // 2. Fetch announcements (active, pinned first, then newest, matching screen scope)
  const fetchAnnouncements = useCallback(async (eventId?: string) => {
    try {
      // First check per-screen assigned announcement
      const screenAnn = getScreenAnnouncement(screenId);

      let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      // Only filter by eventId if provided
      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const normalized: DisplayAnnouncement[] = data.map((a: any) => {
          let priority: 'NORMAL' | 'IMPORTANT' | 'URGENT' = 'NORMAL';
          if (a.priority) {
            priority = a.priority.toUpperCase() as any;
          } else if (a.severity) {
            if (a.severity === 'URGENT') priority = 'URGENT';
            else if (a.severity === 'WARNING') priority = 'IMPORTANT';
            else priority = 'NORMAL';
          }
          return {
            id: a.id,
            event_id: a.event_id,
            title: a.title,
            message: a.message,
            priority,
            pinned: Boolean(a.pinned),
            is_active: Boolean(a.is_active),
            scheduled_at: a.scheduled_at,
            expires_at: a.expires_at,
            created_at: a.created_at || new Date().toISOString(),
            updated_at: a.updated_at,
            created_by: a.created_by,
            scope: a.scope,
          };
        });

        // Filter out expired and screen scope matches (GLOBAL, ALL, or SCREEN_X)
        const now = new Date().getTime();
        const screenScopeKey = `SCREEN_${screenId}`;
        const activeOnly = normalized.filter((a: any) => {
          if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
          if (a.scheduled_at && new Date(a.scheduled_at).getTime() > now) return false;
          if (a.scope && a.scope !== 'GLOBAL' && a.scope !== 'ALL' && a.scope !== screenScopeKey) {
            return false;
          }
          return true;
        });

        if (activeOnly.length > 0) {
          // If a custom screen announcement is set and differs, ensure it's at the front
          const primaryScreenAnn: DisplayAnnouncement = {
            id: screenAnn.id || `screen-${screenId}-ann`,
            title: screenAnn.title,
            message: screenAnn.message,
            priority: screenAnn.priority,
            pinned: Boolean(screenAnn.pinned),
            is_active: true,
            created_at: new Date().toISOString(),
          };
          const merged = [primaryScreenAnn, ...activeOnly.filter(a => a.title !== screenAnn.title)];
          setAnnouncements(merged);
          setLastRefreshedAt(new Date());
          return;
        }
      }

      // Fallback to screen-specific default announcement
      setAnnouncements([
        {
          id: `screen-${screenId}-default`,
          title: screenAnn.title,
          message: screenAnn.message,
          priority: screenAnn.priority,
          pinned: Boolean(screenAnn.pinned),
          is_active: true,
          created_at: new Date().toISOString(),
        }
      ]);
    } catch (err) {
      console.warn('Error fetching announcements for live display:', err);
    }
  }, [screenId]);

  // 3. Fetch leaderboard
  const fetchLeaderboard = useCallback(async (eventId?: string) => {
    try {
      const data = await LeaderboardEngine.getLeaderboard(eventId);
      setLeaderboard(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.warn('Error fetching leaderboard for live display:', err);
    }
  }, []);

  // 4. Initial load and multi-layered real-time sync
  useEffect(() => {
    let mounted = true;
    let eventId: string | undefined;

    const refreshAll = async () => {
      if (!eventId) {
        eventId = await fetchEvent();
      }
      if (!mounted) return;
      await Promise.all([
        fetchAnnouncements(eventId),
        fetchLeaderboard(eventId)
      ]);
    };

    refreshAll();

    // ── Layer 1: Web Standard BroadcastChannel (Instant inter-tab sync) ──
    let localBc: BroadcastChannel | null = null;
    try {
      localBc = new BroadcastChannel('promptify_realtime_sync');
      localBc.onmessage = (msg) => {
        if (msg.data?.type === 'ANNOUNCEMENT_UPDATE' || msg.data?.type === 'SCORE_UPDATE') {
          if (msg.data.announcement) {
            // Instant state patch
            setAnnouncements((prev) => {
              const updated = [msg.data.announcement, ...prev.filter(a => a.id !== msg.data.announcement.id)];
              return updated;
            });
          }
          fetchAnnouncements(eventId);
          fetchLeaderboard(eventId);
        }
      };
    } catch (e) {
      // BroadcastChannel not available in older environments
    }

    // ── Layer 2: Storage Event Listener (Instant cross-window sync in same browser) ──
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'promptify_realtime_trigger' || e.key === 'promptify_active_announcement') {
        fetchAnnouncements(eventId);
        fetchLeaderboard(eventId);
      }
    };
    window.addEventListener('storage', handleStorage);

    // ── Layer 3: Supabase WebSocket Broadcast Channel ──
    const broadcastChannel = supabase.channel('promptify_live_broadcast')
      .on('broadcast', { event: 'announcement_push' }, (payload: any) => {
        if (payload?.payload?.announcement) {
          setAnnouncements((prev) => {
            const item = payload.payload.announcement;
            return [item, ...prev.filter(a => a.id !== item.id)];
          });
        }
        fetchAnnouncements(eventId);
      })
      .on('broadcast', { event: 'score_push' }, () => {
        fetchLeaderboard(eventId);
      })
      .subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
        }
      });

    // ── Layer 4: Supabase Postgres Changes Channel ──
    const postgresChannel = supabase.channel('promptify_postgres_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements(eventId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_sessions' },
        () => {
          fetchLeaderboard(eventId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_events' },
        () => {
          fetchLeaderboard(eventId);
        }
      )
      .subscribe();

    // ── Layer 5: Fast 3-second safety polling fallback ──
    const pollInterval = setInterval(() => {
      fetchAnnouncements(eventId);
      fetchLeaderboard(eventId);
    }, 3000);

    const handleOnline = () => setConnectionStatus('CONNECTED');
    const handleOffline = () => setConnectionStatus('OFFLINE');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (localBc) localBc.close();
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(postgresChannel);
    };
  }, [fetchEvent, fetchAnnouncements, fetchLeaderboard]);

  // 5. 10-Second Auto-Rotation Timer for featured announcements
  useEffect(() => {
    if (announcements.length <= 1) {
      setCurrentSlideIndex(0);
      setRotationProgress(0);
      return;
    }

    const intervalMs = 100;
    const totalDurationMs = 10000;
    const stepIncrement = (intervalMs / totalDurationMs) * 100;

    const timer = setInterval(() => {
      if (isPausedRef.current) return;

      setRotationProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlideIndex((current) => (current + 1) % announcements.length);
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [announcements.length]);

  const pauseRotation = () => { isPausedRef.current = true; };
  const resumeRotation = () => { isPausedRef.current = false; };

  const goToSlide = (idx: number) => {
    setCurrentSlideIndex(idx);
    setRotationProgress(0);
  };

  const nextSlide = () => {
    if (announcements.length > 0) {
      setCurrentSlideIndex((prev) => (prev + 1) % announcements.length);
      setRotationProgress(0);
    }
  };

  const prevSlide = () => {
    if (announcements.length > 0) {
      setCurrentSlideIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
      setRotationProgress(0);
    }
  };

  return {
    eventInfo,
    announcements,
    leaderboard,
    connectionStatus,
    lastRefreshedAt,
    currentSlideIndex,
    rotationProgress,
    pauseRotation,
    resumeRotation,
    goToSlide,
    nextSlide,
    prevSlide,
    refreshNow: () => {
      fetchAnnouncements(eventInfo?.id);
      fetchLeaderboard(eventInfo?.id);
    },
  };
}
