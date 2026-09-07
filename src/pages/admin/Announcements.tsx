import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, Select, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { useAuthStore } from '../../stores/authStore';
import { ZapIcon, TrashIcon, CheckCircleIcon, BrainIcon } from '../../components/icons';
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
  type DisplayPageType,
  type ScreenAnnouncement,
} from '../../lib/screen-sync';

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
}

export default function Announcements({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const { session } = useAuthStore();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'studio' (visual template editor) | 'overview' (all 5 screens) | 'gallery' (all templates history)
  const [activeTab, setActiveTab] = useState<'studio' | 'overview' | 'gallery'>('studio');

  // Active Selected Screen: 0 means 'GLOBAL' (All Screens), 1-5 means Screen 1 to 5
  const [selectedScreen, setSelectedScreen] = useState<number>(1);

  // Template Library list (combining built-in and user-created custom templates)
  const [templateList, setTemplateList] = useState<ScreenAnnouncement[]>(() => getAllTemplates());
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState<ScreenAnnouncement>({
    title: '',
    message: '',
    priority: 'IMPORTANT',
    pinned: true,
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

  // Studio / Modal Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [copiedScreen, setCopiedScreen] = useState<number | null>(null);
  const [templateSavedToast, setTemplateSavedToast] = useState(false);

  const [form, setForm] = useState({
    title: 'STARTS IN 10 MINS',
    message: 'Please take your seats and prepare your workstations. Contest Round 1 is starting shortly!',
    priority: 'URGENT' as 'NORMAL' | 'IMPORTANT' | 'URGENT',
    pinned: true,
    scope: 'SCREEN_1',
    scheduled_at: '',
    expires_at: '',
    is_active: true,
  });

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
            title: a.title,
            message: a.message,
            priority,
            pinned: Boolean(a.pinned),
            is_active: Boolean(a.is_active),
            scheduled_at: a.scheduled_at,
            expires_at: a.expires_at,
            created_at: a.created_at,
            updated_at: a.updated_at,
            created_by: a.created_by,
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

    return () => {
      supabase.removeChannel(channel);
      unsubscribeScreens();
    };
  }, [activeEvent]);

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
      setForm({
        title: ann.title,
        message: ann.message,
        priority: ann.priority,
        pinned: ann.pinned ?? true,
        scope: `SCREEN_${screenId}`,
        scheduled_at: '',
        expires_at: '',
        is_active: true,
      });
      setEditingId(null);
    }
  };

  // 1-Click apply template to currently selected screen
  const applyPreset = (preset: ScreenAnnouncement) => {
    setForm(prev => ({
      ...prev,
      title: preset.title,
      message: preset.message,
      priority: preset.priority,
      pinned: preset.pinned ?? true,
    }));
  };

  // 1-Click Instant Apply & Publish template directly to target screen
  const handleDirectApplyAndPublish = (preset: ScreenAnnouncement, targetScreenId: number) => {
    // Update local form state
    setForm(prev => ({
      ...prev,
      title: preset.title,
      message: preset.message,
      priority: preset.priority,
      pinned: preset.pinned ?? true,
      scope: targetScreenId === 0 ? 'GLOBAL' : `SCREEN_${targetScreenId}`,
    }));

    if (targetScreenId > 0) {
      setScreenAnnouncement(targetScreenId, preset);
      setScreenAnnouncements(prev => ({ ...prev, [targetScreenId]: preset }));
      handlePageChangeForScreen(targetScreenId, 'announcements');
    } else {
      ALL_SCREENS.forEach(s => {
        setScreenAnnouncement(s.id, preset);
        setScreenAnnouncements(prev => ({ ...prev, [s.id]: preset }));
        handlePageChangeForScreen(s.id, 'announcements');
      });
    }

    dispatchRealtimeSync(
      {
        id: `ann-${Date.now()}`,
        title: preset.title,
        message: preset.message,
        priority: preset.priority,
        pinned: preset.pinned ?? true,
        is_active: true,
        scope: targetScreenId === 0 ? 'GLOBAL' : `SCREEN_${targetScreenId}`,
        created_at: new Date().toISOString(),
      },
      targetScreenId
    );
  };

  // Save current form content as a new reusable template
  const handleSaveAsTemplate = () => {
    if (!form.title.trim()) return;
    const newTpl: ScreenAnnouncement = {
      title: form.title,
      message: form.message,
      priority: form.priority,
      pinned: form.pinned,
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
    setNewTemplateForm({ title: '', message: '', priority: 'IMPORTANT', pinned: true });
    setTemplateSavedToast(true);
    setTimeout(() => setTemplateSavedToast(false), 2500);
  };

  // Delete custom template
  const handleDeleteTemplate = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomTemplate(title);
    setTemplateList(getAllTemplates());
  };

  const handlePageChangeForScreen = (screenId: number, page: DisplayPageType) => {
    setScreenPage(screenId, page);
    setScreenPages(prev => ({ ...prev, [screenId]: page }));
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
    if (targetScreenId > 0) {
      setScreenAnnouncement(targetScreenId, {
        title: announcementPayload.title,
        message: announcementPayload.message,
        priority: announcementPayload.priority,
        pinned: announcementPayload.pinned,
      });
      setScreenAnnouncements(prev => ({
        ...prev,
        [targetScreenId]: {
          title: announcementPayload.title,
          message: announcementPayload.message,
          priority: announcementPayload.priority,
          pinned: announcementPayload.pinned,
        }
      }));
    } else {
      // Global: update all screens
      ALL_SCREENS.forEach(s => {
        setScreenAnnouncement(s.id, {
          title: announcementPayload.title,
          message: announcementPayload.message,
          priority: announcementPayload.priority,
          pinned: announcementPayload.pinned,
        });
      });
    }

    // Web BroadcastChannel & Storage Event
    try {
      const bc = new BroadcastChannel('promptify_realtime_sync');
      bc.postMessage({
        type: 'ANNOUNCEMENT_UPDATE',
        announcement: announcementPayload,
        timestamp: Date.now(),
      });
      setTimeout(() => bc.close(), 100);
    } catch (e) {}

    try {
      localStorage.setItem('promptify_active_announcement', JSON.stringify(announcementPayload));
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
            payload: { announcement: announcementPayload, timestamp: Date.now() }
          });
        }
      });
    } catch (e) {}
  };

  const handlePublish = async (shouldBeActive = true) => {
    if (!form.title.trim()) return;
    setSaving(true);

    const severityMap: Record<string, string> = {
      NORMAL: 'INFO',
      IMPORTANT: 'WARNING',
      URGENT: 'URGENT',
    };

    const targetScope = form.scope || (selectedScreen === 0 ? 'GLOBAL' : `SCREEN_${selectedScreen}`);
    const activeEventId = activeEvent?.id || 'default-event';

    const payload: any = {
      event_id: activeEventId,
      title: form.title,
      message: form.message,
      priority: form.priority,
      severity: severityMap[form.priority] || 'INFO',
      pinned: form.pinned,
      scope: targetScope,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: shouldBeActive,
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
    } catch (err) {
      console.error('Error saving announcement:', err);
    } finally {
      setSaving(false);
    }
  };

  const activeScreenPage = selectedScreen > 0 ? (screenPages[selectedScreen] || 'announcements') : 'announcements';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
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
              Select any screen (1 to 5) to edit its distinct template and publish live to projectors.
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

        {/* Screen Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black uppercase text-gray-500 font-heading tracking-wider mr-1">
              Select Screen:
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

          {/* Tab View Switcher (Studio / All Screens Overview / History) */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all font-heading ${
                activeTab === 'studio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎨 Template Studio
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all font-heading ${
                activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🖥️ All Screens Overview
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all font-heading ${
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

      {/* ── 2. VIEW 1: UNIFIED WYSIWYG TEMPLATE STUDIO (Image 2) ── */}
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
                  <span className="text-xs font-bold text-gray-600">
                    {selectedScreen === 0 ? '🌐 Global All Screens' : `🖥️ Screen ${selectedScreen} Preview`}
                  </span>
                </div>
              </div>

              {/* Pop-Art Template Container Preview */}
              <div
                className="w-full aspect-[16/9] rounded-3xl border-2 border-black overflow-hidden flex flex-col justify-between p-6 sm:p-8 bg-[#faf7f2] bg-no-repeat bg-cover bg-center select-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative"
                style={{ backgroundImage: "url('/assets/announcement_template.png')" }}
              >
                {/* Top Status Badges inside Canvas */}
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

                {/* Center Headline & Message */}
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-2 z-10">
                  <div className="space-y-2 max-w-full">
                    <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black font-display tracking-tight text-slate-950 uppercase leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]">
                      {form.title || 'HEADLINE ON TEMPLATE'}
                    </h2>
                    {form.message && (
                      <p className="text-xs sm:text-base lg:text-lg text-slate-900 font-extrabold font-heading leading-tight whitespace-pre-wrap max-w-xl mx-auto drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                        {form.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Canvas Pill */}
                <div className="w-full flex items-center justify-between text-[10px] font-bold text-slate-600 z-10">
                  <span className="bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-black/10 uppercase tracking-wider">
                    {selectedScreen === 0 ? 'All Screens Broadcast' : `Screen ${selectedScreen} Display`}
                  </span>
                  <span className="text-orange-600 font-black">● Broadcasts in Real-Time</span>
                </div>
              </div>
            </div>

            {/* ── Reusable Templates Library (Click to apply / + Add New Template) ── */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ZapIcon className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-black uppercase font-heading tracking-wider text-gray-700">
                    Template Library (Click to display on Screen {selectedScreen === 0 ? 'All' : selectedScreen})
                  </span>
                </div>

                {/* + Add New Template Button */}
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black font-heading transition-all shadow-sm flex items-center gap-1"
                >
                  <span>+ Add New Template</span>
                </button>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {templateList.map((tpl, idx) => {
                  const isSelected = form.title === tpl.title;
                  const isCustom = idx < templateList.length - ANNOUNCEMENT_PRESETS.length;

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

          {/* Right (5 Columns): Template Announcement Edit Form (Image 2) */}
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
                <FormField label="Headline on Template" required>
                  <TextInput
                    value={form.title}
                    onChange={val => setForm(prev => ({ ...prev, title: val.toUpperCase() }))}
                    placeholder="e.g. STARTS IN 10 MINS"
                  />
                </FormField>

                <FormField label="Message Details" required>
                  <TextArea
                    value={form.message}
                    onChange={val => setForm(prev => ({ ...prev, message: val }))}
                    rows={4}
                    placeholder="Please take your seats and prepare your workstations..."
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Priority" required>
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
                  disabled={saving || !form.title.trim()}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black font-heading text-sm shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
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
                  disabled={!form.title.trim()}
                  className="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold font-heading text-xs transition-colors flex items-center justify-center gap-1.5"
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

      {/* ── 3. VIEW 2: ALL SCREENS OVERVIEW (Grid of Screens 1-5) ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_SCREENS.map(s => {
            const assignedPage = screenPages[s.id] || s.defaultPage;
            const ann = screenAnnouncements[s.id] || getScreenAnnouncement(s.id);
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
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                    >
                      ↗ Launch
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200 mb-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Active Output View:</div>
                    <div className="text-xs font-black text-gray-900 mt-0.5 flex items-center gap-1.5">
                      <span>{pageConfig?.icon}</span>
                      <span>{pageConfig?.label}</span>
                    </div>
                  </div>

                  {/* Announcement Mini Card */}
                  <div className="bg-[#faf7f2] border-2 border-black rounded-2xl p-3.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500 text-white mb-1 inline-block">
                      {ann.priority}
                    </span>
                    <div className="font-display font-black text-slate-950 text-sm uppercase leading-tight">
                      {ann.title}
                    </div>
                    <div className="text-[11px] text-slate-700 font-bold mt-1 line-clamp-2">
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
                    className="text-xs font-black text-orange-600 hover:underline flex items-center gap-1"
                  >
                    ✏️ Edit Screen {s.id} Template
                  </button>
                  <button
                    onClick={() => copyScreenLink(s.id)}
                    className="text-xs font-bold text-gray-500 hover:text-black"
                  >
                    {copiedScreen === s.id ? '✓ Copied' : '🔗 Copy URL'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. VIEW 3: ANNOUNCEMENT HISTORY ── */}
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
                        });
                        setEditingId(item.id);
                        setActiveTab('studio');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs"
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
