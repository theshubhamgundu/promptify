import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, Select, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { useAuthStore } from '../../stores/authStore';
import { ZapIcon, TrashIcon, CheckCircleIcon, BrainIcon } from '../../components/icons';
import { BlurAnimatedTimer } from '../../components/BlurAnimatedTimer';
import {
  ALL_SCREENS,
  DISPLAY_PAGES,
  ANNOUNCEMENT_PRESETS,
  getScreenPage,
  setScreenPage,
  getScreenAnnouncement,
  setScreenAnnouncement,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  subscribeToScreenChanges,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  getTimerState,
  subscribeToTimerChanges,
  type DisplayPageType,
  type ScreenAnnouncement,
  type TimerState,
} from '../../lib/screen-sync';
import {
  getAllBackgrounds,
  getBackgroundById,
  saveCustomBackground,
  deleteCustomBackground,
  getScreenBackground,
  setScreenBackground,
  getGlobalDefaultBackground,
  setGlobalDefaultBackground,
  subscribeToBackgroundChanges,
  type TemplateBackground,
} from '../../lib/backgrounds-store';
import {
  getAllVideos,
  saveCustomVideo,
  deleteCustomVideo,
  getGlobalVideoConfig,
  setGlobalVideoConfig,
  getScreenVideoConfig,
  setScreenVideoConfig,
  subscribeToVideoChanges,
  type VideoItem,
  type VideoPlayerConfig,
} from '../../lib/video-store';

interface AnnouncementItem {
  id: string;
  event_id: string;
  scope: string;
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
  bg_url?: string;
  hide_text?: boolean;
}

export default function Announcements({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const { user, session } = useAuthStore();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'studio' | 'videos' | 'overview' | 'gallery' | 'backgrounds'
  const [activeTab, setActiveTab] = useState<'studio' | 'videos' | 'overview' | 'gallery' | 'backgrounds'>('studio');

  // Active Selected Screen: 0 means 'GLOBAL' (All Screens), 1-5 means Screen 1 to 5
  const [selectedScreen, setSelectedScreen] = useState<number>(1);

  // Backgrounds Library State
  const [backgroundsList, setBackgroundsList] = useState<TemplateBackground[]>(() => getAllBackgrounds());
  const [bgCategoryFilter, setBgCategoryFilter] = useState<string>('ALL');
  const [showAddBackgroundModal, setShowAddBackgroundModal] = useState(false);
  const [bgActionToast, setBgActionToast] = useState<string | null>(null);

  // Video Library & Player State
  const [videosList, setVideosList] = useState<VideoItem[]>(() => getAllVideos());
  const [videoConfig, setVideoConfig] = useState<VideoPlayerConfig>(() => getGlobalVideoConfig());
  const [videoMode, setVideoMode] = useState(false);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [newVideoForm, setNewVideoForm] = useState({
    name: '',
    description: '',
    url: '/assets/cinematic_loop.mp4',
  });

  const [newBgForm, setNewBgForm] = useState<{
    name: string;
    description: string;
    url: string;
    category: TemplateBackground['category'];
    textColor: 'dark' | 'light';
  }>({
    name: '',
    description: '',
    url: '',
    category: 'custom',
    textColor: 'dark',
  });

  // Template Library list (combining built-in and user-created custom templates)
  const [templateList, setTemplateList] = useState<ScreenAnnouncement[]>(() => getAllTemplates());
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState<ScreenAnnouncement>({
    title: '',
    message: '',
    priority: 'IMPORTANT',
    pinned: true,
    bg_url: '/assets/announcement_template.png',
  });

  // Screen to Page mapping
  const [screenPages, setScreenPages] = useState<Record<number, DisplayPageType>>(() => {
    const initial: Record<number, DisplayPageType> = {};
    ALL_SCREENS.forEach(s => {
      initial[s.id] = getScreenPage(s.id);
    });
    return initial;
  });

  // Screen to Announcement mapping
  const [screenAnnouncements, setScreenAnnouncements] = useState<Record<number, ScreenAnnouncement>>(() => {
    const initial: Record<number, ScreenAnnouncement> = {};
    ALL_SCREENS.forEach(s => {
      initial[s.id] = getScreenAnnouncement(s.id);
    });
    return initial;
  });

  // Screen to Background mapping
  const [screenBackgrounds, setScreenBackgrounds] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    ALL_SCREENS.forEach(s => {
      initial[s.id] = getScreenBackground(s.id);
    });
    return initial;
  });

  // Studio / Modal Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [copiedScreen, setCopiedScreen] = useState<number | null>(null);
  const [templateSavedToast, setTemplateSavedToast] = useState(false);

  // Timer mode: when true, canvas shows timer preview instead of announcement
  const [timerMode, setTimerMode] = useState(false);
  const [timerState, setLocalTimerState] = useState<TimerState>(() => getTimerState());
  const [timerRemaining, setTimerRemaining] = useState<number>(2400);
  const [timerDurationInput, setTimerDurationInput] = useState<number>(40); // minutes

  const [form, setForm] = useState({
    title: 'STARTS IN 10 MINS',
    message: 'Please take your seats and prepare your workstations. Contest Round 1 is starting shortly!',
    priority: 'URGENT' as 'NORMAL' | 'IMPORTANT' | 'URGENT',
    pinned: true,
    scope: 'SCREEN_1',
    scheduled_at: '',
    expires_at: '',
    is_active: true,
    bg_url: '/assets/announcement_template.png',
    hide_text: false,
  });

  const showToast = (msg: string) => {
    setBgActionToast(msg);
    setTimeout(() => setBgActionToast(null), 3000);
  };

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('event_id', activeEvent.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        const normalized: AnnouncementItem[] = data.map((a: any) => {
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
            scope: a.scope || 'GLOBAL',
            title: a.title || '',
            message: a.message || '',
            priority,
            pinned: Boolean(a.pinned),
            is_active: Boolean(a.is_active),
            scheduled_at: a.scheduled_at,
            expires_at: a.expires_at,
            created_at: a.created_at,
            updated_at: a.updated_at,
            created_by: a.created_by,
            bg_url: a.bg_url || a.background_url,
            hide_text: Boolean(a.hide_text),
          };
        });
        setAnnouncements(normalized);
      }
    } catch (e) {
      console.error('Error loading announcements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!activeEvent) return;
    const channel = supabase
      .channel('admin_announcements_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        loadData();
      })
      .subscribe();

    const unsubscribeScreens = subscribeToScreenChanges(
      (screenId, page) => {
        setScreenPages(prev => ({ ...prev, [screenId]: page }));
      },
      (screenId, ann) => {
        setScreenAnnouncements(prev => ({ ...prev, [screenId]: ann }));
      }
    );

    const unsubscribeBackgrounds = subscribeToBackgroundChanges(() => {
      setBackgroundsList(getAllBackgrounds());
      const updatedScreenBgs: Record<number, string> = {};
      ALL_SCREENS.forEach(s => {
        updatedScreenBgs[s.id] = getScreenBackground(s.id);
      });
      setScreenBackgrounds(updatedScreenBgs);
    });

    const unsubscribeTimer = subscribeToTimerChanges((newState) => {
      setLocalTimerState(newState);
    });

    const unsubscribeVideos = subscribeToVideoChanges((newConfig) => {
      setVideoConfig(newConfig);
      setVideosList(getAllVideos());
    });

    return () => {
      supabase.removeChannel(channel);
      unsubscribeScreens();
      unsubscribeBackgrounds();
      unsubscribeTimer();
      unsubscribeVideos();
    };
  }, [activeEvent]);

  // Live countdown tick
  useEffect(() => {
    const tick = () => {
      const ts = getTimerState();
      setLocalTimerState(ts);
      if (ts.status === 'running' && ts.startedAt) {
        const elapsed = (Date.now() - new Date(ts.startedAt).getTime()) / 1000;
        setTimerRemaining(Math.max(0, ts.duration - elapsed));
      } else if (ts.status === 'paused' && ts.pausedRemaining != null) {
        setTimerRemaining(ts.pausedRemaining);
      } else if (ts.status === 'idle') {
        setTimerRemaining(ts.duration);
      } else {
        setTimerRemaining(0);
      }
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, []);

  // When selectedScreen changes, load that screen's announcement into the form
  const handleSelectScreen = (screenId: number) => {
    setSelectedScreen(screenId);
    if (screenId === 0) {
      // Global (All Screens)
      setForm(prev => ({
        ...prev,
        scope: 'GLOBAL',
      }));
    } else {
      const ann = screenAnnouncements[screenId] || getScreenAnnouncement(screenId);
      const scrBg = screenBackgrounds[screenId] || getScreenBackground(screenId);
      setForm({
        title: ann.title || '',
        message: ann.message || '',
        priority: ann.priority || 'IMPORTANT',
        pinned: ann.pinned ?? true,
        scope: `SCREEN_${screenId}`,
        scheduled_at: '',
        expires_at: '',
        is_active: true,
        bg_url: ann.bg_url || scrBg || '/assets/announcement_template.png',
        hide_text: Boolean(ann.hide_text),
      });
      setEditingId(null);
    }
  };

  // Screen Page & Timer / Video Helpers
  const handlePageChangeForScreen = (screenId: number, page: DisplayPageType) => {
    setScreenPage(screenId, page);
    setScreenPages(prev => ({ ...prev, [screenId]: page }));
  };

  const toggleScreenTimer = (screenId: number) => {
    const currentPage = screenPages[screenId] || getScreenPage(screenId);
    const newPage: DisplayPageType = currentPage === 'timer' ? 'announcements' : 'timer';
    handlePageChangeForScreen(screenId, newPage);
  };

  const setAllScreensTimer = (enable: boolean) => {
    ALL_SCREENS.forEach(s => {
      handlePageChangeForScreen(s.id, enable ? 'timer' : 'announcements');
    });
  };

  const toggleScreenVideo = (screenId: number) => {
    const currentPage = screenPages[screenId] || getScreenPage(screenId);
    const newPage: DisplayPageType = currentPage === 'video' ? 'announcements' : 'video';
    handlePageChangeForScreen(screenId, newPage);
  };

  const setAllScreensVideo = (enable: boolean) => {
    ALL_SCREENS.forEach(s => {
      handlePageChangeForScreen(s.id, enable ? 'video' : 'announcements');
    });
  };

  const handleSelectVideo = (video: VideoItem) => {
    setVideoConfig(prev => {
      const updated = { ...prev, videoUrl: video.url, title: video.name };
      setGlobalVideoConfig(updated);
      return updated;
    });
    showToast(`✓ Video "${video.name}" selected!`);
  };

  const handleBroadcastVideoToScreen = (targetScreenId: number, video?: VideoItem) => {
    const urlToUse = video ? video.url : videoConfig.videoUrl;
    const titleToUse = video ? video.name : (videoConfig.title || 'Cinematic Loop');

    const cfg: VideoPlayerConfig = { ...videoConfig, videoUrl: urlToUse, title: titleToUse };
    setVideoConfig(cfg);

    if (targetScreenId === 0) {
      setGlobalVideoConfig(cfg);
      ALL_SCREENS.forEach(s => {
        setScreenVideoConfig(s.id, cfg);
        handlePageChangeForScreen(s.id, 'video');
      });
      showToast(`🎬 Video loop broadcasted to All Screens!`);
    } else {
      setScreenVideoConfig(targetScreenId, cfg);
      handlePageChangeForScreen(targetScreenId, 'video');
      showToast(`🎬 Video loop broadcasted to Screen ${targetScreenId}!`);
    }
  };

  const handleSaveCustomVideoModal = () => {
    if (!newVideoForm.name.trim() || !newVideoForm.url.trim()) return;
    const saved = saveCustomVideo({
      name: newVideoForm.name.trim(),
      description: newVideoForm.description.trim() || 'Custom user uploaded video',
      url: newVideoForm.url.trim(),
    });
    setVideosList(getAllVideos());
    setShowAddVideoModal(false);
    handleSelectVideo(saved);
    setNewVideoForm({ name: '', description: '', url: '/assets/cinematic_loop.mp4' });
    showToast(`✓ New video "${saved.name}" added to library!`);
  };

  const handleDeleteVideo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomVideo(id);
    setVideosList(getAllVideos());
    showToast('✓ Video deleted from library');
  };

  // 1-Click apply template to currently selected screen
  const applyPreset = (preset: ScreenAnnouncement) => {
    setForm(prev => ({
      ...prev,
      title: preset.title || '',
      message: preset.message || '',
      priority: preset.priority || 'IMPORTANT',
      pinned: preset.pinned ?? true,
      bg_url: preset.bg_url || prev.bg_url,
      hide_text: Boolean(preset.hide_text),
    }));
  };

  // 1-Click Instant Apply & Publish template directly to target screen
  const handleDirectApplyAndPublish = (preset: ScreenAnnouncement, targetScreenId: number) => {
    const bgUrlToUse = preset.bg_url || form.bg_url || '/assets/announcement_template.png';
    const isClean = Boolean(preset.hide_text || (!preset.title?.trim() && !preset.message?.trim()));
    const payloadWithBg: ScreenAnnouncement = {
      ...preset,
      bg_url: bgUrlToUse,
      hide_text: isClean,
    };

    // Update local form state
    setForm(prev => ({
      ...prev,
      title: preset.title || '',
      message: preset.message || '',
      priority: preset.priority || 'IMPORTANT',
      pinned: preset.pinned ?? true,
      bg_url: bgUrlToUse,
      scope: targetScreenId === 0 ? 'GLOBAL' : `SCREEN_${targetScreenId}`,
      hide_text: isClean,
    }));

    if (targetScreenId > 0) {
      setScreenAnnouncement(targetScreenId, payloadWithBg);
      setScreenAnnouncements(prev => ({ ...prev, [targetScreenId]: payloadWithBg }));
      handlePageChangeForScreen(targetScreenId, 'announcements');
    } else {
      ALL_SCREENS.forEach(s => {
        setScreenAnnouncement(s.id, payloadWithBg);
        setScreenAnnouncements(prev => ({ ...prev, [s.id]: payloadWithBg }));
        handlePageChangeForScreen(s.id, 'announcements');
      });
    }

    dispatchRealtimeSync(
      {
        id: `ann-${Date.now()}`,
        title: preset.title || '',
        message: preset.message || '',
        priority: preset.priority || 'IMPORTANT',
        pinned: preset.pinned ?? true,
        bg_url: bgUrlToUse,
        hide_text: isClean,
        is_active: true,
        scope: targetScreenId === 0 ? 'GLOBAL' : `SCREEN_${targetScreenId}`,
        created_at: new Date().toISOString(),
      },
      targetScreenId
    );
  };

  // Save current form content as a new reusable template
  const handleSaveAsTemplate = () => {
    const isClean = Boolean(form.hide_text || (!form.title?.trim() && !form.message?.trim()));
    const newTpl: ScreenAnnouncement = {
      title: form.title?.trim() || (isClean ? 'Clean Background Template' : 'Untitled Template'),
      message: form.message || '',
      priority: form.priority,
      pinned: form.pinned,
      bg_url: form.bg_url,
      hide_text: isClean,
    };
    saveCustomTemplate(newTpl);
    setTemplateList(getAllTemplates());
    setTemplateSavedToast(true);
    setTimeout(() => setTemplateSavedToast(false), 2500);
  };

  // Create new template from Modal
  const handleCreateNewTemplateModal = () => {
    if (!newTemplateForm.title.trim()) return;
    saveCustomTemplate(newTemplateForm);
    setTemplateList(getAllTemplates());
    // Also apply it to active form
    applyPreset(newTemplateForm);
    setShowAddTemplateModal(false);
    setNewTemplateForm({
      title: '',
      message: '',
      priority: 'IMPORTANT',
      pinned: true,
      bg_url: '/assets/announcement_template.png',
    });
    setTemplateSavedToast(true);
    setTimeout(() => setTemplateSavedToast(false), 2500);
  };

  // Delete custom template
  const handleDeleteTemplate = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomTemplate(title);
    setTemplateList(getAllTemplates());
  };

  // ── Background Management Handlers ─────────────────────────────────────────
  const handleSelectBackgroundForCurrentAnnouncement = (bg: TemplateBackground) => {
    const bgVal = bg.id || bg.url;
    setForm(prev => ({ ...prev, bg_url: bgVal }));
    if (selectedScreen > 0) {
      setScreenBackground(selectedScreen, bgVal);
      setScreenBackgrounds(prev => ({ ...prev, [selectedScreen]: bgVal }));
    } else {
      ALL_SCREENS.forEach(s => setScreenBackground(s.id, bgVal));
      setGlobalDefaultBackground(bgVal);
      const updated: Record<number, string> = {};
      ALL_SCREENS.forEach(s => {
        updated[s.id] = getScreenBackground(s.id);
      });
      setScreenBackgrounds(updated);
    }
    showToast(`✓ Background "${bg.name}" applied to current announcement & screen!`);
    setActiveTab('studio');
  };

  const handleApplyBackgroundToScreen = (screenId: number, bg: TemplateBackground) => {
    const bgVal = bg.id || bg.url;
    if (screenId === 0) {
      ALL_SCREENS.forEach(s => setScreenBackground(s.id, bgVal));
      setGlobalDefaultBackground(bgVal);
      showToast(`✓ Background "${bg.name}" set for All Screens!`);
    } else {
      setScreenBackground(screenId, bgVal);
      showToast(`✓ Background "${bg.name}" assigned to Screen ${screenId}!`);
    }
    const updated: Record<number, string> = {};
    ALL_SCREENS.forEach(s => {
      updated[s.id] = getScreenBackground(s.id);
    });
    setScreenBackgrounds(updated);
    setForm(prev => ({ ...prev, bg_url: bgVal }));
  };

  const handleSaveCustomBackgroundModal = () => {
    if (!newBgForm.name.trim() || !newBgForm.url.trim()) return;
    const saved = saveCustomBackground({
      name: newBgForm.name.trim(),
      description: newBgForm.description.trim() || 'Custom user-uploaded background',
      url: newBgForm.url.trim(),
      category: newBgForm.category,
      textColor: newBgForm.textColor,
    });
    setBackgroundsList(getAllBackgrounds());
    setShowAddBackgroundModal(false);
    setNewBgForm({
      name: '',
      description: '',
      url: '',
      category: 'custom',
      textColor: 'dark',
    });
    showToast(`✓ New background "${saved.name}" added to library!`);
  };

  const handleDeleteBackground = (bgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomBackground(bgId);
    setBackgroundsList(getAllBackgrounds());
    showToast('✓ Background deleted');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (under 4MB)
    if (file.size > 4 * 1024 * 1024) {
      alert('File is too large. Please select an image under 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setNewBgForm(prev => ({
          ...prev,
          url: dataUrl,
          name: prev.name || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toUpperCase(),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const launchScreen = (screenId: number) => {
    const url = `${window.location.origin}/display?screen=${screenId}`;
    window.open(url, `_blank`, 'noopener,noreferrer');
  };

  const launchAllScreens = () => {
    ALL_SCREENS.forEach(s => launchScreen(s.id));
  };

  const copyScreenLink = (screenId: number) => {
    const url = `${window.location.origin}/display?screen=${screenId}`;
    navigator.clipboard.writeText(url);
    setCopiedScreen(screenId);
    setTimeout(() => setCopiedScreen(null), 2000);
  };

  // Multi-layered Real-Time Broadcast Dispatcher
  const dispatchRealtimeSync = (announcementPayload: any, targetScreenId: number) => {
    const isClean = Boolean(
      announcementPayload.hide_text ??
      (form.hide_text || (!announcementPayload.title?.trim() && !announcementPayload.message?.trim()))
    );

    const annData = {
      title: announcementPayload.title || '',
      message: announcementPayload.message || '',
      priority: announcementPayload.priority || 'IMPORTANT',
      pinned: announcementPayload.pinned,
      bg_url: announcementPayload.bg_url || form.bg_url,
      hide_text: isClean,
    };

    if (targetScreenId > 0) {
      setScreenAnnouncement(targetScreenId, annData);
      setScreenAnnouncements(prev => ({
        ...prev,
        [targetScreenId]: annData,
      }));
    } else {
      // Global: update all screens
      ALL_SCREENS.forEach(s => {
        setScreenAnnouncement(s.id, annData);
      });
    }

    // Web BroadcastChannel & Storage Event
    try {
      const bc = new BroadcastChannel('promptify_realtime_sync');
      bc.postMessage({
        type: 'ANNOUNCEMENT_UPDATE',
        announcement: { ...announcementPayload, bg_url: annData.bg_url, hide_text: isClean },
        timestamp: Date.now(),
      });
      setTimeout(() => bc.close(), 100);
    } catch (e) {}

    try {
      localStorage.setItem('promptify_active_announcement', JSON.stringify({ ...announcementPayload, bg_url: annData.bg_url, hide_text: isClean }));
      localStorage.setItem('promptify_realtime_trigger', Date.now().toString());
    } catch (e) {}

    // Supabase WebSocket Broadcast
    try {
      const channel = supabase.channel('promptify_live_broadcast');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'announcement_push',
            payload: { announcement: { ...announcementPayload, bg_url: annData.bg_url, hide_text: isClean }, timestamp: Date.now() }
          });
        }
      });
    } catch (e) {}
  };

  const handlePublish = async (shouldBeActive = true) => {
    setSaving(true);

    const severityMap: Record<string, string> = {
      NORMAL: 'INFO',
      IMPORTANT: 'WARNING',
      URGENT: 'URGENT',
    };

    const targetScope = form.scope || (selectedScreen === 0 ? 'GLOBAL' : `SCREEN_${selectedScreen}`);
    const activeEventId = activeEvent?.id || 'default-event';
    const isClean = Boolean(form.hide_text || (!form.title?.trim() && !form.message?.trim()));

    const payload: any = {
      event_id: activeEventId,
      title: form.title || '',
      message: form.message || '',
      priority: form.priority,
      severity: severityMap[form.priority] || 'INFO',
      pinned: form.pinned,
      scope: targetScope,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: shouldBeActive,
      bg_url: form.bg_url || '/assets/announcement_template.png',
      hide_text: isClean,
    };

    try {
      if (editingId) {
        await supabase
          .from('announcements')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
      } else if (activeEvent?.id) {
        const { data } = await supabase
          .from('announcements')
          .insert([payload])
          .select()
          .single();

        if (data) {
          setEditingId(data.id);
        }
      }

      // Dispatch instant realtime update across tabs/projectors
      dispatchRealtimeSync(
        { id: editingId || `ann-${Date.now()}`, ...payload, created_at: new Date().toISOString() },
        selectedScreen
      );

      // If screen mode was not set to announcements, ensure it is set to announcements
      if (selectedScreen > 0) {
        handlePageChangeForScreen(selectedScreen, 'announcements');
      }

      loadData();
      showToast('⚡ Broadcasted live to screens!');
    } catch (err) {
      console.error('Error saving announcement:', err);
    } finally {
      setSaving(false);
    }
  };

  const activeScreenPage = selectedScreen > 0 ? (screenPages[selectedScreen] || 'announcements') : 'announcements';

  // Compute active background for Live Canvas Preview
  const activeBgObj = getBackgroundById(form.bg_url);
  const isDarkBg = activeBgObj.textColor === 'light';

  // Filtered backgrounds for gallery tab
  const filteredBackgrounds = backgroundsList.filter(b => {
    if (bgCategoryFilter === 'ALL') return true;
    if (bgCategoryFilter === 'builtin') return b.isBuiltIn;
    if (bgCategoryFilter === 'custom') return !b.isBuiltIn;
    return b.category === bgCategoryFilter;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification Alert */}
      {bgActionToast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce bg-black text-white px-4 py-2.5 rounded-2xl border-2 border-orange-400 shadow-2xl text-xs font-black font-heading flex items-center gap-2">
          <span>{bgActionToast}</span>
        </div>
      )}

      {/* ── 1. Top Screen Selector & Control Bar ── */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🖥️</span>
              <h1 className="text-2xl font-black font-heading text-gray-900 tracking-tight">
                Screen Displays & Template Studio
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 font-medium">
              Customize announcement templates, manage template backgrounds, and broadcast to projectors in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={launchAllScreens}
              className="text-xs font-bold"
            >
              🚀 Launch All 5 Screens
            </Button>
            {selectedScreen > 0 && (
              <Button
                variant="primary"
                onClick={() => launchScreen(selectedScreen)}
                className="text-xs font-bold shadow-md shadow-orange-500/20"
              >
                🖥️ Launch Screen {selectedScreen}
              </Button>
            )}
          </div>
        </div>

        {/* Screen Selector Tabs & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black uppercase text-gray-500 font-heading tracking-wider mr-1">
              Target Screen:
            </span>

            {/* Global / All Screens */}
            <button
              onClick={() => handleSelectScreen(0)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black font-heading transition-all border ${
                selectedScreen === 0
                  ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-[1.02]'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
              }`}
            >
              🌐 All Screens (Global)
            </button>

            {/* Screens 1 through 5 */}
            {ALL_SCREENS.map(s => {
              const isSelected = selectedScreen === s.id;
              const assignedPage = screenPages[s.id] || s.defaultPage;
              const pageInfo = DISPLAY_PAGES.find(p => p.id === assignedPage);

              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectScreen(s.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black font-heading transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-amber-400 text-black border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] scale-[1.03]'
                      : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200 shadow-sm'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                    {s.id}
                  </span>
                  <span>{s.label}</span>
                  <span className="text-xs opacity-75">{pageInfo?.icon}</span>
                </button>
              );
            })}
          </div>

          {/* Tab View Switcher (Studio / Video Player / Backgrounds Hub / Overview / History) */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all font-heading ${
                activeTab === 'studio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎨 Template Studio
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all font-heading flex items-center gap-1 ${
                activeTab === 'videos' ? 'bg-red-600 text-white shadow-sm' : 'text-red-600 hover:text-red-700'
              }`}
            >
              <span>🎬 Video Loop Player</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'videos' ? 'bg-black/30 text-white' : 'bg-red-100 text-red-700'
              }`}>
                {videosList.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('backgrounds')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all font-heading flex items-center gap-1 ${
                activeTab === 'backgrounds' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              <span>🖼️ Backgrounds Hub</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'backgrounds' ? 'bg-black/30 text-white' : 'bg-orange-100 text-orange-700'
              }`}>
                {backgroundsList.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all font-heading ${
                activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🖥️ All Screens Overview
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all font-heading ${
                activeTab === 'gallery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 History ({announcements.length})
            </button>
          </div>
        </div>

        {/* Active Screen Mode / Page Bar (If Screen 1-5 is selected) */}
        {selectedScreen > 0 && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-amber-900 font-heading">
                Screen {selectedScreen} Output Mode:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {DISPLAY_PAGES.map(p => {
                  const isActive = activeScreenPage === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePageChangeForScreen(selectedScreen, p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                        isActive
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-gray-700 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600 bg-white px-2 py-0.5 rounded-md border border-amber-200">
                /display?screen={selectedScreen}
              </span>
              <button
                onClick={() => copyScreenLink(selectedScreen)}
                className="text-xs font-bold text-amber-900 hover:underline"
              >
                {copiedScreen === selectedScreen ? '✓ Copied' : '🔗 Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. VIEW 1: UNIFIED WYSIWYG TEMPLATE STUDIO ── */}
      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left / Top (7 Columns): Live Interactive Template Canvas & Template Library */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-xs font-black uppercase font-heading tracking-wider text-gray-700">
                    Interactive Live Template Canvas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    🖼️ Bg: {activeBgObj.name}
                  </span>
                  <span className="text-xs font-bold text-gray-600">
                    {selectedScreen === 0 ? '🌐 Global All Screens' : `🖥️ Screen ${selectedScreen} Preview`}
                  </span>
                </div>
              </div>

              {/* Template Container Preview with dynamic background and adaptive text */}
              <div
                className="w-full aspect-[16/9] rounded-3xl border-2 border-black overflow-hidden flex flex-col justify-between p-6 sm:p-8 bg-[#faf7f2] bg-no-repeat bg-cover bg-center select-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative transition-all duration-300"
                style={{ backgroundImage: videoMode ? 'none' : `url("${activeBgObj.url}")` }}
              >
                {videoMode ? (
                  /* ── Video Loop Preview in Canvas ── */
                  <>
                    <div className="w-full flex items-center justify-between z-10">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-600 text-white font-heading shadow-sm flex items-center gap-1">
                        <span>🎬 VIDEO LOOP MODE</span>
                      </span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500 text-white font-bold">
                        ● LIVE PREVIEW
                      </span>
                    </div>

                    <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center">
                      <video
                        key={videoConfig.videoUrl}
                        src={videoConfig.videoUrl}
                        autoPlay
                        loop={videoConfig.loop}
                        muted={videoConfig.muted}
                        playsInline
                        className={`w-full h-full ${videoConfig.objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                      />
                    </div>

                    <div className="w-full flex items-center justify-between text-[10px] font-bold text-white z-10 mt-auto">
                      <span className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 uppercase tracking-wider">
                        {selectedScreen === 0 ? 'All Screens' : `Screen ${selectedScreen}`} · 🎬 {videoConfig.title || 'Cinematic Video'}
                      </span>
                      <button
                        onClick={() => setVideoMode(false)}
                        className="text-amber-300 hover:text-white font-black hover:underline cursor-pointer bg-black/80 px-3 py-1 rounded-full border border-white/20"
                      >
                        ← Back to Canvas
                      </button>
                    </div>
                  </>
                ) : timerMode ? (
                  /* ── Timer Preview in Canvas ── */
                  <>
                    <div className="w-full flex items-center justify-between z-10">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-600 text-white font-heading shadow-sm flex items-center gap-1">
                        <span>⏳ TIMER MODE</span>
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        timerState.status === 'running' ? 'bg-emerald-500 text-white' :
                        timerState.status === 'paused' ? 'bg-amber-500 text-black' :
                        'bg-slate-300 text-slate-700'
                      }`}>
                        {timerState.status === 'running' ? '● LIVE' :
                         timerState.status === 'paused' ? '⏸ PAUSED' :
                         '○ IDLE'}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-end text-center pb-2 z-10">
                      <div className="mb-1">
                        <BlurAnimatedTimer
                          minutes={Math.floor(Math.ceil(timerRemaining) / 60)}
                          seconds={Math.ceil(timerRemaining) % 60}
                          isUrgent={timerState.status === 'running' && timerRemaining <= timerState.duration * 0.25}
                          isCritical={timerState.status === 'running' && timerRemaining <= timerState.duration * 0.05}
                          isFinished={timerRemaining <= 0 && (timerState.status === 'running' || timerState.status === 'finished')}
                          isLightText={isDarkBg}
                          sizeClass="text-[3rem] sm:text-[4rem] lg:text-[4.5rem]"
                        />
                      </div>
                      <div className="w-48 h-1.5 bg-slate-300/50 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${
                            timerState.status === 'running' && timerRemaining <= timerState.duration * 0.05 ? 'bg-red-500' :
                            timerState.status === 'running' && timerRemaining <= timerState.duration * 0.25 ? 'bg-orange-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${timerState.duration > 0 ? (timerRemaining / timerState.duration) * 100 : 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1">
                        {timerState.status === 'idle' ? 'Waiting for admin to start timer' :
                         timerRemaining <= 0 ? 'TIME\'S UP!' :
                         `${Math.floor(Math.ceil(timerRemaining) / 60)} min ${Math.ceil(timerRemaining) % 60} sec remaining`}
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between text-[10px] font-bold text-slate-600 z-10">
                      <span className="bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-black/10 uppercase tracking-wider">
                        {selectedScreen === 0 ? 'All Screens' : `Screen ${selectedScreen}`} · ⏳ Timer
                      </span>
                      <button
                        onClick={() => setTimerMode(false)}
                        className="text-purple-600 font-black hover:underline cursor-pointer"
                      >
                        ← Back to Announcements
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Normal Announcement Preview in Canvas ── */
                  <>
                    {/* Top Status Badges inside Canvas (only when text overlay is active) */}
                    {!form.hide_text && (form.title?.trim() || form.message?.trim()) ? (
                      <div className="w-full flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full text-white font-heading shadow-sm ${
                              form.priority === 'URGENT'
                                ? 'bg-red-600'
                                : form.priority === 'IMPORTANT'
                                ? 'bg-amber-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            {form.priority}
                          </span>
                          {form.pinned && (
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-600 text-white font-heading shadow-sm">
                              📌 PINNED
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-black/20 text-slate-800">
                          Just now
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-4 z-10" />
                    )}

                    {/* Center Headline & Message */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-2 z-10">
                      {!form.hide_text && (form.title?.trim() || form.message?.trim()) ? (
                        <div className="space-y-2 max-w-full">
                          {form.title?.trim() && (
                            <h2 className={`text-2xl sm:text-4xl lg:text-5xl font-black font-display tracking-tight uppercase leading-none ${
                              isDarkBg
                                ? 'text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]'
                                : 'text-slate-950 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]'
                            }`}>
                              {form.title}
                            </h2>
                          )}
                          {form.message?.trim() && (
                            <p className={`text-xs sm:text-base lg:text-lg font-extrabold font-heading leading-tight whitespace-pre-wrap max-w-xl mx-auto ${
                              isDarkBg
                                ? 'text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]'
                                : 'text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]'
                            }`}>
                              {form.message}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-md">
                          <span className="text-xs">🖼️</span>
                          <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
                            Clean Background (No Text Overlay)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Canvas Pill */}
                    <div className="w-full flex items-center justify-between text-[10px] font-bold z-10">
                      <span className="bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-black/10 uppercase tracking-wider text-slate-800">
                        {selectedScreen === 0 ? 'All Screens Broadcast' : `Screen ${selectedScreen} Display`}
                      </span>
                      <span className="text-orange-600 font-black bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-black/10">
                        ● Broadcasts in Real-Time
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* ── Timer Controls (shown when timer mode is active) ── */}
              {timerMode && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 mt-3 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⏳</span>
                      <div>
                        <h4 className="text-xs font-black text-white font-heading uppercase tracking-wider">Timer Controls</h4>
                        <p className="text-[10px] text-slate-400">Set duration & control countdown</p>
                      </div>

                      <div className={`font-mono font-black text-2xl tracking-wider px-3 py-1 rounded-lg border-2 ${
                        timerState.status === 'running'
                          ? timerRemaining <= timerState.duration * 0.05 ? 'text-red-400 border-red-500/50 bg-red-950/40 animate-pulse'
                            : timerRemaining <= timerState.duration * 0.25 ? 'text-orange-400 border-orange-500/50 bg-orange-950/40'
                            : 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40'
                          : timerState.status === 'paused'
                          ? 'text-amber-400 border-amber-500/50 bg-amber-950/40'
                          : 'text-slate-400 border-slate-600 bg-slate-800'
                      }`}>
                        {String(Math.floor(Math.ceil(timerRemaining) / 60)).padStart(2, '0')}:{String(Math.ceil(timerRemaining) % 60).padStart(2, '0')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-600">
                        <input
                          type="number"
                          value={timerDurationInput}
                          onChange={(e) => setTimerDurationInput(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                          className="w-12 bg-transparent text-white text-xs font-mono font-bold text-center outline-none"
                          min={1}
                          max={120}
                        />
                        <span className="text-[10px] text-slate-400 font-bold">min</span>
                      </div>

                      <button
                        onClick={() => resetTimer(timerDurationInput * 60)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase transition-all"
                      >
                        Set Timer
                      </button>

                      {timerState.status === 'idle' && (
                        <button
                          onClick={() => {
                            startTimer(timerDurationInput * 60);
                          }}
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/30"
                        >
                          ▶ Start
                        </button>
                      )}
                      {timerState.status === 'running' && (
                        <button
                          onClick={() => pauseTimer()}
                          className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase transition-all shadow-lg shadow-amber-500/30"
                        >
                          ⏸ Pause
                        </button>
                      )}
                      {timerState.status === 'paused' && (
                        <button
                          onClick={() => resumeTimer()}
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/30"
                        >
                          ▶ Resume
                        </button>
                      )}

                      <button
                        onClick={() => resetTimer(timerDurationInput * 60)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase transition-all"
                      >
                        ↺ Reset
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider font-heading flex items-center gap-1">
                        <span>📺 Display Timer On Screen(s):</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const allActive = ALL_SCREENS.every(s => (screenPages[s.id] || getScreenPage(s.id)) === 'timer');
                          setAllScreensTimer(!allActive);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                          ALL_SCREENS.every(s => (screenPages[s.id] || getScreenPage(s.id)) === 'timer')
                            ? 'bg-purple-600 text-white shadow-purple-500/40 ring-2 ring-purple-300'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        <span>🌐 All Screens</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                          ALL_SCREENS.every(s => (screenPages[s.id] || getScreenPage(s.id)) === 'timer') ? 'bg-purple-900 text-white' : 'bg-black/30 text-slate-300'
                        }`}>
                          {ALL_SCREENS.every(s => (screenPages[s.id] || getScreenPage(s.id)) === 'timer') ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      {ALL_SCREENS.map(s => {
                        const isTimer = (screenPages[s.id] || getScreenPage(s.id)) === 'timer';
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleScreenTimer(s.id)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                              isTimer
                                ? 'bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-300'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                            }`}
                          >
                            <span>🖥️ Screen {s.id}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                              isTimer ? 'bg-emerald-950 text-emerald-200 font-bold' : 'bg-slate-900 text-slate-400'
                            }`}>
                              {isTimer ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Reusable Templates Library ── */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ZapIcon className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-black uppercase font-heading tracking-wider text-gray-700">
                    Template & Motion Library (Click to display on Screen {selectedScreen === 0 ? 'All' : selectedScreen})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('videos')}
                    className="px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all border border-red-200 flex items-center gap-1"
                  >
                    <span>🎬 Video Player</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('backgrounds')}
                    className="px-2.5 py-1 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-all border border-orange-200 flex items-center gap-1"
                  >
                    <span>🖼️ Backgrounds Hub</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTemplateModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black font-heading transition-all shadow-sm flex items-center gap-1"
                  >
                    <span>+ Add New Template</span>
                  </button>
                </div>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {/* Special Video Loop Template Card */}
                <div
                  onClick={() => {
                    setVideoMode(true);
                    setTimerMode(false);
                    handleBroadcastVideoToScreen(selectedScreen);
                  }}
                  className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col justify-between shadow-sm ${
                    videoMode
                      ? 'border-red-500 bg-red-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-dashed border-red-400 bg-gradient-to-br from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 hover:border-red-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-600 text-white flex items-center gap-1">
                        <span>🎬 VIDEO</span>
                      </span>
                      <span className="text-[9px] font-bold text-red-600">
                        Motion Loop
                      </span>
                    </div>
                    <div className="text-xs font-black font-heading text-red-900 group-hover:text-red-700">
                      🎬 PROMPTIFY ANIMATED LOOP
                    </div>
                    <div className="text-[11px] text-red-700 font-medium mt-0.5">
                      Animated Promptify text motion graphic loop.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoMode(true);
                      setTimerMode(false);
                      handleBroadcastVideoToScreen(selectedScreen);
                    }}
                    className="mt-2.5 w-full py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-transform active:scale-95 shadow-sm"
                    title={`Broadcast video loop to Screen ${selectedScreen === 0 ? 'All' : selectedScreen}`}
                  >
                    <span>⚡ Play on Screen {selectedScreen === 0 ? 'All' : selectedScreen}</span>
                  </button>
                </div>

                {/* Special Timer Template Card */}
                <div
                  onClick={() => {
                    setTimerMode(true);
                    setVideoMode(false);
                    if (selectedScreen > 0) {
                      handlePageChangeForScreen(selectedScreen, 'timer');
                    } else {
                      ALL_SCREENS.forEach(s => handlePageChangeForScreen(s.id, 'timer'));
                    }
                  }}
                  className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer relative group flex flex-col justify-between shadow-sm ${
                    timerMode
                      ? 'border-purple-500 bg-purple-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'border-dashed border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 hover:border-purple-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-600 text-white">
                        ⏳ TIMER
                      </span>
                      <span className={`text-[9px] font-bold ${
                        timerState.status === 'running' ? 'text-emerald-600' :
                        timerState.status === 'paused' ? 'text-amber-600' :
                        'text-purple-500 opacity-0 group-hover:opacity-100'
                      } transition-opacity`}>
                        {timerState.status === 'running' ? '● LIVE' :
                         timerState.status === 'paused' ? '⏸ PAUSED' :
                         'Click to configure'}
                      </span>
                    </div>
                    <div className="text-xs font-black font-heading text-purple-900 group-hover:text-purple-700">
                      ⏳ 40-MIN ROUND TIMER
                    </div>
                    <div className="text-[11px] text-purple-700 font-medium mt-0.5">
                      Full-screen countdown. Use controls above to set & start.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimerMode(true);
                      setVideoMode(false);
                      if (selectedScreen > 0) {
                        handlePageChangeForScreen(selectedScreen, 'timer');
                      } else {
                        ALL_SCREENS.forEach(s => handlePageChangeForScreen(s.id, 'timer'));
                      }
                    }}
                    className="mt-2.5 w-full py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-transform active:scale-95 shadow-sm"
                    title={`Show timer on Screen ${selectedScreen === 0 ? 'All' : selectedScreen}`}
                  >
                    <span>⚡ Apply to Screen {selectedScreen === 0 ? 'All' : selectedScreen}</span>
                  </button>
                </div>

                {templateList.map((tpl, idx) => {
                  const isSelected = form.title === tpl.title;
                  const isCustom = idx < templateList.length - ANNOUNCEMENT_PRESETS.length;
                  const tplBg = getBackgroundById(tpl.bg_url);

                  return (
                    <div
                      key={idx}
                      onClick={() => applyPreset(tpl)}
                      className={`text-left p-3 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-100/90 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-gray-50 hover:bg-orange-50/80 border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                tpl.priority === 'URGENT'
                                  ? 'bg-red-500 text-white'
                                  : tpl.priority === 'IMPORTANT'
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {tpl.priority}
                            </span>
                            {tpl.bg_url && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold" title={`Bg: ${tplBg.name}`}>
                                🖼️
                              </span>
                            )}
                          </div>

                          {/* Delete button if custom template */}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(tpl.title, e)}
                              className="text-gray-400 hover:text-red-600 text-xs p-0.5"
                              title="Delete this template"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="text-xs font-black font-heading text-gray-900 group-hover:text-orange-600 line-clamp-1">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-gray-600 font-medium line-clamp-2 mt-0.5">
                          {tpl.message}
                        </div>
                      </div>

                      {/* 1-Click Instant Apply & Publish Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectApplyAndPublish(tpl, selectedScreen);
                        }}
                        className="mt-2.5 w-full py-1.5 rounded-xl bg-black hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-transform active:scale-95 shadow-sm"
                        title={`Instantly apply & broadcast to Screen ${selectedScreen === 0 ? 'All' : selectedScreen}`}
                      >
                        <span>⚡ Apply to Screen {selectedScreen === 0 ? 'All' : selectedScreen}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right (5 Columns): Template Announcement Edit Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-black font-heading text-gray-900">
                  {selectedScreen === 0 ? 'Broadcast Announcement' : `Screen ${selectedScreen} Announcement`}
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {selectedScreen === 0 ? 'All Screens' : `Target: Screen ${selectedScreen}`}
                </span>
              </div>

              <div className="space-y-4">
                {/* ── Quick Mode Toggle: Background Only / Text Overlay ── */}
                <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(form.hide_text || (!form.title?.trim() && !form.message?.trim()))}
                      onChange={e => setForm(prev => ({ ...prev, hide_text: e.target.checked }))}
                      className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-400"
                    />
                    <div>
                      <div className="text-xs font-black text-gray-900 font-heading">
                        🖼️ Only Background (Hide text overlays)
                      </div>
                      <div className="text-[10px] text-gray-600 font-medium">
                        Display clean template poster without headline, message, or top badges
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, title: '', message: '', hide_text: true }))}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition-all shrink-0 cursor-pointer"
                    title="Clear title and message text"
                  >
                    🧹 Clear Text
                  </button>
                </div>

                <FormField label="Headline on Template (Optional)">
                  <TextInput
                    value={form.title}
                    onChange={val => setForm(prev => ({ ...prev, title: val.toUpperCase(), hide_text: false }))}
                    placeholder="Leave blank for clean background only"
                  />
                </FormField>

                <FormField label="Message Details (Optional)">
                  <TextArea
                    value={form.message}
                    onChange={val => setForm(prev => ({ ...prev, message: val, hide_text: false }))}
                    rows={3}
                    placeholder="Leave blank for clean background only..."
                  />
                </FormField>

                {/* ── Visual Template Background Selector ── */}
                <div className="space-y-2 bg-orange-50/50 p-3 rounded-2xl border border-orange-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-gray-800 font-heading tracking-wide flex items-center gap-1.5">
                      <span>🖼️ Template Background Style</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('backgrounds')}
                      className="text-[11px] text-orange-600 font-bold hover:underline"
                    >
                      Browse All Hub →
                    </button>
                  </div>

                  {/* Horizontal visual background selector chips */}
                  <div className="grid grid-cols-2 gap-2">
                    {backgroundsList.slice(0, 6).map(bg => {
                      const bgVal = bg.id || bg.url;
                      const isBgActive = form.bg_url === bg.id || form.bg_url === bg.url;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, bg_url: bgVal }));
                            if (selectedScreen > 0) {
                              setScreenBackground(selectedScreen, bgVal);
                              setScreenBackgrounds(prev => ({ ...prev, [selectedScreen]: bgVal }));
                            } else {
                              ALL_SCREENS.forEach(s => setScreenBackground(s.id, bgVal));
                              setGlobalDefaultBackground(bgVal);
                              const updated: Record<number, string> = {};
                              ALL_SCREENS.forEach(s => {
                                updated[s.id] = getScreenBackground(s.id);
                              });
                              setScreenBackgrounds(updated);
                            }
                          }}
                          className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                            isBgActive
                              ? 'bg-orange-500 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200'
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg border border-black/20 bg-cover bg-center shrink-0"
                            style={{ backgroundImage: `url("${bg.url}")` }}
                          />
                          <div className="overflow-hidden">
                            <div className="text-[11px] font-black truncate leading-tight">{bg.name}</div>
                            <div className={`text-[9px] uppercase font-bold truncate ${isBgActive ? 'text-orange-100' : 'text-gray-500'}`}>
                              {bg.category}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1">
                    <Select
                      value={form.bg_url || '/assets/announcement_template.png'}
                      onChange={val => {
                        setForm(prev => ({ ...prev, bg_url: val }));
                        if (selectedScreen > 0) {
                          setScreenBackground(selectedScreen, val);
                          setScreenBackgrounds(prev => ({ ...prev, [selectedScreen]: val }));
                        } else {
                          ALL_SCREENS.forEach(s => setScreenBackground(s.id, val));
                          setGlobalDefaultBackground(val);
                          const updated: Record<number, string> = {};
                          ALL_SCREENS.forEach(s => {
                            updated[s.id] = getScreenBackground(s.id);
                          });
                          setScreenBackgrounds(updated);
                        }
                      }}
                      options={backgroundsList.map(bg => ({
                        value: bg.id || bg.url,
                        label: `${bg.name} (${bg.category})`,
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Priority">
                    <Select
                      value={form.priority}
                      onChange={val => setForm(prev => ({ ...prev, priority: val as any }))}
                      options={[
                        { value: 'URGENT', label: 'Urgent Alert (Red)' },
                        { value: 'IMPORTANT', label: 'Important (Amber)' },
                        { value: 'NORMAL', label: 'Normal Notice' },
                      ]}
                    />
                  </FormField>

                  <FormField label="Target Screen Scope">
                    <Select
                      value={form.scope || (selectedScreen === 0 ? 'GLOBAL' : `SCREEN_${selectedScreen}`)}
                      onChange={val => {
                        setForm(prev => ({ ...prev, scope: val }));
                        if (val.startsWith('SCREEN_')) {
                          setSelectedScreen(parseInt(val.replace('SCREEN_', ''), 10));
                        } else {
                          setSelectedScreen(0);
                        }
                      }}
                      options={[
                        { value: 'GLOBAL', label: '🌐 All Screens (Global)' },
                        { value: 'SCREEN_1', label: '🖥️ Screen 1 (Projector 1)' },
                        { value: 'SCREEN_2', label: '🖥️ Screen 2 (Projector 2)' },
                        { value: 'SCREEN_3', label: '🖥️ Screen 3 (Projector 3)' },
                        { value: 'SCREEN_4', label: '🖥️ Screen 4 (Projector 4)' },
                        { value: 'SCREEN_5', label: '🖥️ Screen 5 (Projector 5)' },
                      ]}
                    />
                  </FormField>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.pinned}
                      onChange={e => setForm({ ...form, pinned: e.target.checked })}
                      className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-400"
                    />
                    <span className="text-xs font-bold text-gray-800">📌 Always Pinned</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start Time (Optional)">
                    <input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>

                  <FormField label="Expiry Time (Optional)">
                    <input
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={e => setForm({ ...form, expires_at: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>
                </div>
              </div>

              {/* Action Buttons: Save Template & Publish Live */}
              <div className="pt-4 border-t border-gray-100 space-y-2.5">
                <button
                  onClick={() => handlePublish(true)}
                  disabled={saving}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black font-heading text-sm shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ZapIcon className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Publishing…'
                      : selectedScreen === 0
                      ? '⚡ 🚀 Publish Live to All Screens'
                      : `⚡ 🚀 Publish Live to Screen ${selectedScreen}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  className="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold font-heading text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>💾 Save Current as Reusable Template</span>
                </button>

                {templateSavedToast && (
                  <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold text-center animate-fade-in">
                    ✓ Saved into Template Library!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. VIEW: VIDEO LOOP PLAYER (Centralized Video Motion Graphic Hub) ── */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 rounded-3xl text-white shadow-xl shadow-red-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🎬</span>
                <h2 className="text-2xl font-black font-display tracking-tight uppercase">
                  Cinematic Video Loop Player
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-red-100 font-medium max-w-2xl">
                Broadcast full-screen high-energy cinematic motion graphics and video loops to your digital screens. Plays smoothly in a continuous seamless loop with instant real-time synchronization.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddVideoModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-black hover:bg-slate-900 text-white font-black font-heading text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>+ Upload / Add Video</span>
              </button>
              <button
                type="button"
                onClick={() => handleBroadcastVideoToScreen(0)}
                className="px-4 py-2.5 rounded-2xl bg-white hover:bg-red-50 text-red-700 font-black font-heading text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>⚡ 🚀 Broadcast to All Screens</span>
              </button>
            </div>
          </div>

          {/* Player Settings Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-black uppercase text-gray-700 font-heading">Player Options:</span>
              
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={videoConfig.loop}
                  onChange={e => {
                    const updated = { ...videoConfig, loop: e.target.checked };
                    setVideoConfig(updated);
                    setGlobalVideoConfig(updated);
                  }}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-400"
                />
                <span className="text-xs font-bold text-gray-800">🔁 Continuous Loop</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={videoConfig.muted}
                  onChange={e => {
                    const updated = { ...videoConfig, muted: e.target.checked };
                    setVideoConfig(updated);
                    setGlobalVideoConfig(updated);
                  }}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-400"
                />
                <span className="text-xs font-bold text-gray-800">🔇 Muted (Autoplay Safe)</span>
              </label>

              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <span className="text-xs font-bold text-gray-600">Fit:</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated: VideoPlayerConfig = { ...videoConfig, objectFit: 'cover' };
                    setVideoConfig(updated);
                    setGlobalVideoConfig(updated);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    videoConfig.objectFit === 'cover' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cover (Full-Bleed)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated: VideoPlayerConfig = { ...videoConfig, objectFit: 'contain' };
                    setVideoConfig(updated);
                    setGlobalVideoConfig(updated);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    videoConfig.objectFit === 'contain' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Contain (Letterbox)
                </button>
              </div>
            </div>

            <div className="text-xs font-bold text-gray-500">
              {videosList.length} Video{videosList.length !== 1 ? 's' : ''} in Library
            </div>
          </div>

          {/* Videos Visual Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videosList.map(v => {
              const isSelected = videoConfig.videoUrl === v.url;
              return (
                <div
                  key={v.id}
                  className={`bg-white rounded-3xl border-2 overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group ${
                    isSelected ? 'border-red-500 ring-2 ring-red-300' : 'border-gray-200 hover:border-black'
                  }`}
                >
                  {/* Visual Video Preview Container */}
                  <div className="w-full aspect-[16/9] bg-black relative flex items-center justify-center overflow-hidden border-b-2 border-black">
                    <video
                      src={v.url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={`w-full h-full ${videoConfig.objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shadow">
                        {v.duration || 'VIDEO'}
                      </span>
                      {v.isBuiltIn && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-black backdrop-blur-sm">
                          Built-in
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                          ✓ ACTIVE
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-black font-heading text-gray-900">{v.name}</h4>
                        {!v.isBuiltIn && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVideo(v.id, e)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold p-1"
                            title="Delete custom video"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-medium mt-1">
                        {v.description || 'Cinematic video loop'}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleBroadcastVideoToScreen(selectedScreen, v)}
                        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
                      >
                        <ZapIcon className="w-3.5 h-3.5" />
                        <span>Play on Screen {selectedScreen === 0 ? 'All' : selectedScreen}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleBroadcastVideoToScreen(0, v)}
                          className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase transition-all"
                          title="Broadcast to All Screens"
                        >
                          🌐 All Screens
                        </button>
                        {[1, 2, 3, 4, 5].map(scrNum => (
                          <button
                            key={scrNum}
                            type="button"
                            onClick={() => handleBroadcastVideoToScreen(scrNum, v)}
                            className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase transition-all"
                            title={`Broadcast to Screen ${scrNum}`}
                          >
                            S{scrNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. VIEW: BACKGROUNDS HUB (Centralized Template Backgrounds Gallery) ── */}
      {activeTab === 'backgrounds' && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-6 rounded-3xl text-white shadow-xl shadow-orange-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🖼️</span>
                <h2 className="text-2xl font-black font-display tracking-tight uppercase">
                  Template Backgrounds Hub
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-orange-100 font-medium max-w-2xl">
                All template backgrounds in one place. Choose distinct backgrounds for different announcements, assign background styles to individual screens, or upload your own high-resolution image templates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddBackgroundModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-black hover:bg-slate-900 text-white font-black font-heading text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>+ Upload / Add Background</span>
              </button>
            </div>
          </div>

          {/* Category Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-black uppercase text-gray-500 font-heading mr-1">Filter:</span>
              {[
                { id: 'ALL', label: `All (${backgroundsList.length})` },
                { id: 'builtin', label: `🎨 Official Templates (${backgroundsList.filter(b => b.isBuiltIn).length})` },
                { id: 'custom', label: `📁 My Custom Templates (${backgroundsList.filter(b => !b.isBuiltIn).length})` },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setBgCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    bgCategoryFilter === cat.id
                      ? 'bg-black text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-gray-500">
              Showing {filteredBackgrounds.length} Backgrounds
            </div>
          </div>

          {/* Backgrounds Visual Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBackgrounds.map(bg => {
              const isDark = bg.textColor === 'light';
              const isCurrentFormBg = form.bg_url === bg.id || form.bg_url === bg.url;

              return (
                <div
                  key={bg.id}
                  className="bg-white rounded-3xl border-2 border-gray-200 hover:border-black overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  {/* Visual 16:9 Canvas Preview with Sample Content */}
                  <div
                    className="w-full aspect-[16/9] bg-[#faf7f2] bg-no-repeat bg-cover bg-center p-4 flex flex-col justify-between relative border-b-2 border-black"
                    style={{ backgroundImage: `url("${bg.url}")` }}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/80 text-white backdrop-blur-sm">
                        {bg.category}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-indigo-900/90 text-indigo-200' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {isDark ? '🌙 Light Text Mode' : '☀️ Dark Text Mode'}
                      </span>
                    </div>

                    {/* Sample Headline Typography */}
                    <div className="text-center px-2 z-10">
                      <div className={`text-lg sm:text-xl font-black font-display uppercase leading-tight ${
                        isDark ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'text-slate-950 drop-shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                      }`}>
                        {bg.name}
                      </div>
                      <div className={`text-[10px] font-bold mt-1 line-clamp-1 ${
                        isDark ? 'text-slate-200' : 'text-slate-700'
                      }`}>
                        Live announcement template preview
                      </div>
                    </div>

                    {/* Bottom Status */}
                    <div className="flex items-center justify-between text-[9px] font-bold z-10">
                      <span className="bg-white/80 backdrop-blur-sm px-1.5 py-0.2 rounded text-black font-mono">
                        {bg.isBuiltIn ? 'Built-in Template' : 'Custom Upload'}
                      </span>
                      {isCurrentFormBg && (
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black">
                          ✓ ACTIVE IN STUDIO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body & Actions */}
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-black font-heading text-gray-900">{bg.name}</h4>
                        {!bg.isBuiltIn && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBackground(bg.id, e)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold p-1"
                            title="Delete custom background"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-medium mt-1">
                        {bg.description}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      {/* Primary: Use for Current Studio Announcement */}
                      <button
                        type="button"
                        onClick={() => handleSelectBackgroundForCurrentAnnouncement(bg)}
                        className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
                      >
                        <ZapIcon className="w-3.5 h-3.5" />
                        <span>Use for Current Announcement</span>
                      </button>

                      {/* Secondary: Apply to Screen 1..5 or All */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleApplyBackgroundToScreen(0, bg)}
                          className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase transition-all"
                          title="Set as background for All Screens"
                        >
                          🌐 All Screens
                        </button>
                        {[1, 2, 3, 4, 5].map(scrNum => (
                          <button
                            key={scrNum}
                            type="button"
                            onClick={() => handleApplyBackgroundToScreen(scrNum, bg)}
                            className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase transition-all"
                            title={`Assign to Screen ${scrNum}`}
                          >
                            S{scrNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. VIEW: ALL SCREENS OVERVIEW (Grid of Screens 1-5) ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_SCREENS.map(s => {
            const assignedPage = screenPages[s.id] || s.defaultPage;
            const ann = screenAnnouncements[s.id] || getScreenAnnouncement(s.id);
            const scrBg = screenBackgrounds[s.id] || getScreenBackground(s.id);
            const bgObj = getBackgroundById(ann.bg_url || scrBg);
            const pageConfig = DISPLAY_PAGES.find(p => p.id === assignedPage);

            return (
              <div
                key={s.id}
                className="bg-white rounded-3xl border-2 border-gray-200 hover:border-black/30 p-5 shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center font-black text-black font-heading text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {s.id}
                      </span>
                      <div>
                        <h4 className="text-base font-black font-heading text-gray-900">{s.label}</h4>
                        <span className="text-[11px] text-emerald-600 font-bold">● Active on Projector {s.id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => launchScreen(s.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      ↗ Launch
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Output Mode:</div>
                      <div className="text-xs font-black text-gray-900 mt-0.5 flex items-center gap-1">
                        <span>{pageConfig?.icon}</span>
                        <span className="truncate">{pageConfig?.label}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Assigned Bg:</div>
                      <div className="text-xs font-black text-orange-700 mt-0.5 truncate flex items-center gap-1">
                        <span>🖼️</span>
                        <span className="truncate">{bgObj.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Announcement Mini Card */}
                  <div
                    className="border-2 border-black rounded-2xl p-3.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-cover bg-center"
                    style={{ backgroundImage: `url("${bgObj.url}")` }}
                  >
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500 text-white mb-1 inline-block">
                      {ann.priority}
                    </span>
                    <div className={`font-display font-black text-sm uppercase leading-tight ${
                      bgObj.textColor === 'light' ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : 'text-slate-950'
                    }`}>
                      {ann.title}
                    </div>
                    <div className={`text-[11px] font-bold mt-1 line-clamp-2 ${
                      bgObj.textColor === 'light' ? 'text-slate-200' : 'text-slate-700'
                    }`}>
                      {ann.message}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      handleSelectScreen(s.id);
                      setActiveTab('studio');
                    }}
                    className="text-xs font-black text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ✏️ Edit Screen {s.id} Template
                  </button>
                  <button
                    onClick={() => copyScreenLink(s.id)}
                    className="text-xs font-bold text-gray-500 hover:text-black cursor-pointer"
                  >
                    {copiedScreen === s.id ? '✓ Copied' : '🔗 Copy URL'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. VIEW: ANNOUNCEMENT HISTORY ── */}
      {activeTab === 'gallery' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <h3 className="text-lg font-black font-heading text-gray-900">
              Announcement History & Archive
            </h3>
            <span className="text-xs font-bold text-gray-500">{announcements.length} items</span>
          </div>

          <div className="divide-y divide-gray-100">
            {announcements.length === 0 ? (
              <div className="py-12 text-center text-gray-400 font-medium">
                No past announcements found.
              </div>
            ) : (
              announcements.map(item => (
                <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{item.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {item.scope || 'GLOBAL'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.message}</p>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setForm({
                          title: item.title,
                          message: item.message,
                          priority: item.priority,
                          pinned: item.pinned,
                          scope: item.scope,
                          scheduled_at: item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '',
                          expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '',
                          is_active: item.is_active,
                          bg_url: item.bg_url || '/assets/announcement_template.png',
                        });
                        setEditingId(item.id);
                        setActiveTab('studio');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 cursor-pointer"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs cursor-pointer"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Add New Template Modal ── */}
      {showAddTemplateModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddTemplateModal(false)}
          title="✨ Create New Reusable Template"
        >
          <div className="space-y-4">
            <FormField label="Headline Title" required>
              <TextInput
                value={newTemplateForm.title}
                onChange={val => setNewTemplateForm(prev => ({ ...prev, title: val.toUpperCase() }))}
                placeholder="e.g. ROUND 3: FINAL SPRINT"
              />
            </FormField>

            <FormField label="Message Details" required>
              <TextArea
                value={newTemplateForm.message}
                onChange={val => setNewTemplateForm(prev => ({ ...prev, message: val }))}
                placeholder="Enter message for contenders on the digital screens..."
                rows={3}
              />
            </FormField>

            <FormField label="Template Background">
              <Select
                value={newTemplateForm.bg_url || '/assets/announcement_template.png'}
                onChange={val => setNewTemplateForm(prev => ({ ...prev, bg_url: val }))}
                options={backgroundsList.map(b => ({
                  value: b.id || b.url,
                  label: `${b.name} (${b.category})`,
                }))}
              />
            </FormField>

            <FormField label="Priority">
              <Select
                value={newTemplateForm.priority}
                onChange={val => setNewTemplateForm(prev => ({ ...prev, priority: val as any }))}
                options={[
                  { value: 'URGENT', label: '🚨 Urgent Alert (Red)' },
                  { value: 'IMPORTANT', label: '⚠️ Important (Amber)' },
                  { value: 'NORMAL', label: 'ℹ️ Normal Notice' },
                ]}
              />
            </FormField>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddTemplateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateNewTemplateModal}>
                💾 Save & Add to Template Library
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add / Upload Custom Video Modal ── */}
      {showAddVideoModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddVideoModal(false)}
          title="🎬 Add / Upload Custom Video Loop"
        >
          <div className="space-y-4">
            <FormField label="Video Title" required>
              <TextInput
                value={newVideoForm.name}
                onChange={val => setNewVideoForm(prev => ({ ...prev, name: val }))}
                placeholder="e.g. Hackathon Cinematic Teaser"
              />
            </FormField>

            <FormField label="Description (Optional)">
              <TextInput
                value={newVideoForm.description}
                onChange={val => setNewVideoForm(prev => ({ ...prev, description: val }))}
                placeholder="e.g. 10-second cinematic video loop"
              />
            </FormField>

            {/* Video File / URL Selector */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <label className="text-xs font-black uppercase text-gray-700 font-heading">
                Option 1: Upload Video File (MP4, WebM, MOV)
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100 * 1024 * 1024) {
                    alert('Video is too large. Please select a video under 100MB.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    if (dataUrl) {
                      setNewVideoForm(prev => ({
                        ...prev,
                        url: dataUrl,
                        name: prev.name || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toUpperCase(),
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-red-600 file:text-white hover:file:bg-red-700 file:cursor-pointer"
              />

              <div className="pt-2 border-t border-gray-200">
                <FormField label="Option 2: Or Paste Direct Video URL / Path">
                  <TextInput
                    value={newVideoForm.url.startsWith('data:') ? '' : newVideoForm.url}
                    onChange={val => setNewVideoForm(prev => ({ ...prev, url: val }))}
                    placeholder="/assets/cinematic_loop.mp4 or https://..."
                  />
                </FormField>
              </div>
            </div>

            {/* Live Interactive Preview */}
            {newVideoForm.url && (
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-500 font-heading">
                  Video Preview:
                </label>
                <div className="w-full aspect-[16/9] rounded-2xl border-2 border-black overflow-hidden bg-black flex items-center justify-center">
                  <video
                    src={newVideoForm.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddVideoModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!newVideoForm.name.trim() || !newVideoForm.url.trim()}
                onClick={handleSaveCustomVideoModal}
              >
                💾 Save Video to Library
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add / Upload Custom Background Modal ── */}
      {showAddBackgroundModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddBackgroundModal(false)}
          title="🖼️ Upload / Add Custom Template Background"
        >
          <div className="space-y-4">
            <FormField label="Background Name" required>
              <TextInput
                value={newBgForm.name}
                onChange={val => setNewBgForm(prev => ({ ...prev, name: val }))}
                placeholder="e.g. Neon Hackathon Banner"
              />
            </FormField>

            <FormField label="Description (Optional)">
              <TextInput
                value={newBgForm.description}
                onChange={val => setNewBgForm(prev => ({ ...prev, description: val }))}
                placeholder="e.g. Dark high-contrast background with circuit lines"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category">
                <Select
                  value={newBgForm.category}
                  onChange={val => setNewBgForm(prev => ({ ...prev, category: val as any }))}
                  options={[
                    { value: 'custom', label: '📁 Custom Upload' },
                    { value: 'pop-art', label: '🎨 Pop-Art Style' },
                    { value: 'dark', label: '🌌 Dark / Cyber' },
                    { value: 'celebration', label: '🏆 Celebration / Gold' },
                    { value: 'alert', label: '🚨 Urgent Alert' },
                    { value: 'minimal', label: '✨ Minimal Studio' },
                  ]}
                />
              </FormField>

              <FormField label="Typography Contrast">
                <Select
                  value={newBgForm.textColor}
                  onChange={val => setNewBgForm(prev => ({ ...prev, textColor: val as any }))}
                  options={[
                    { value: 'dark', label: '☀️ Dark Text (for light bgs)' },
                    { value: 'light', label: '🌙 Light Text (for dark bgs)' },
                  ]}
                />
              </FormField>
            </div>

            {/* File Upload / URL Section */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <label className="text-xs font-black uppercase text-gray-700 font-heading">
                Option 1: Upload Image File (PNG, JPG, WebP, SVG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-orange-500 file:text-white hover:file:bg-orange-600 file:cursor-pointer"
              />

              <div className="pt-2 border-t border-gray-200">
                <FormField label="Option 2: Or Paste Direct Image URL">
                  <TextInput
                    value={newBgForm.url.startsWith('data:') ? '' : newBgForm.url}
                    onChange={val => setNewBgForm(prev => ({ ...prev, url: val }))}
                    placeholder="https://example.com/background.jpg"
                  />
                </FormField>
              </div>
            </div>

            {/* Live Interactive Preview */}
            {newBgForm.url && (
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-500 font-heading">
                  Interactive Preview:
                </label>
                <div
                  className="w-full aspect-[16/9] rounded-2xl border-2 border-black overflow-hidden p-4 flex flex-col justify-between bg-cover bg-center"
                  style={{ backgroundImage: `url("${newBgForm.url}")` }}
                >
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black text-white w-max">
                    PREVIEW
                  </span>
                  <div className="text-center">
                    <h3 className={`text-xl font-black font-display uppercase ${
                      newBgForm.textColor === 'light' ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]' : 'text-slate-950'
                    }`}>
                      {newBgForm.name || 'HEADLINE PREVIEW'}
                    </h3>
                    <p className={`text-xs font-bold mt-1 ${
                      newBgForm.textColor === 'light' ? 'text-slate-200' : 'text-slate-700'
                    }`}>
                      Sample announcement message on custom template background
                    </p>
                  </div>
                  <div className="text-[9px] text-right font-mono font-bold text-slate-500">
                    Promptify Template Canvas
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAddBackgroundModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!newBgForm.name.trim() || !newBgForm.url.trim()}
                onClick={handleSaveCustomBackgroundModal}
              >
                💾 Save Background to Hub
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (deleteTarget) {
              await supabase.from('announcements').delete().eq('id', deleteTarget.id);
              setDeleteTarget(null);
              loadData();
            }
          }}
          title="Delete Announcement"
          message={`Are you sure you want to delete "${deleteTarget.title}"?`}
          variant="danger"
        />
      )}
    </div>
  );
}
