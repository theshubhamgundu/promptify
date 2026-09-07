import { useState, useEffect } from 'react';
import type { Page } from '../../components/Layout';
import { Button, Modal, FormField, TextInput, TextArea, Select } from '../../components/ui';
import {
  ALL_SCREENS,
  DISPLAY_PAGES,
  ANNOUNCEMENT_PRESETS,
  getScreenPage,
  setScreenPage,
  getScreenAnnouncement,
  setScreenAnnouncement,
  subscribeToScreenChanges,
  type DisplayPageType,
  type ScreenAnnouncement,
} from '../../lib/screen-sync';

export default function ScreenManager({ navigate }: { navigate: (p: Page) => void }) {
  // Current mapping of screen -> page
  const [screenPages, setScreenPages] = useState<Record<number, DisplayPageType>>(() => {
    const initial: Record<number, DisplayPageType> = {};
    ALL_SCREENS.forEach(s => {
      initial[s.id] = getScreenPage(s.id);
    });
    return initial;
  });

  // Current mapping of screen -> custom announcement
  const [screenAnnouncements, setScreenAnnouncements] = useState<Record<number, ScreenAnnouncement>>(() => {
    const initial: Record<number, ScreenAnnouncement> = {};
    ALL_SCREENS.forEach(s => {
      initial[s.id] = getScreenAnnouncement(s.id);
    });
    return initial;
  });

  const [copiedScreen, setCopiedScreen] = useState<number | null>(null);

  // Template Editing Modal for a specific screen
  const [editingScreenId, setEditingScreenId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ScreenAnnouncement>({
    title: '',
    message: '',
    priority: 'NORMAL',
    pinned: true,
  });

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToScreenChanges(
      (screenId, newPage) => {
        setScreenPages(prev => ({ ...prev, [screenId]: newPage }));
      },
      (screenId, newAnnouncement) => {
        setScreenAnnouncements(prev => ({ ...prev, [screenId]: newAnnouncement }));
      }
    );
    return unsubscribe;
  }, []);

  const handlePageChange = (screenId: number, page: DisplayPageType) => {
    setScreenPage(screenId, page);
    setScreenPages(prev => ({ ...prev, [screenId]: page }));
  };

  const handleQuickTemplateApply = (screenId: number, preset: ScreenAnnouncement) => {
    setScreenAnnouncement(screenId, preset);
    setScreenAnnouncements(prev => ({ ...prev, [screenId]: preset }));
  };

  const openEditModal = (screenId: number) => {
    const current = screenAnnouncements[screenId] || getScreenAnnouncement(screenId);
    setEditForm({ ...current });
    setEditingScreenId(screenId);
  };

  const saveScreenAnnouncementModal = () => {
    if (editingScreenId !== null) {
      setScreenAnnouncement(editingScreenId, editForm);
      setScreenAnnouncements(prev => ({ ...prev, [editingScreenId]: editForm }));
      setEditingScreenId(null);
    }
  };

  const launchScreen = (screenId: number) => {
    const url = `${window.location.origin}/display?screen=${screenId}`;
    window.open(url, `_blank`, 'noopener,noreferrer');
  };

  const launchAllScreens = () => {
    ALL_SCREENS.forEach(s => {
      launchScreen(s.id);
    });
  };

  const copyScreenLink = (screenId: number) => {
    const url = `${window.location.origin}/display?screen=${screenId}`;
    navigator.clipboard.writeText(url);
    setCopiedScreen(screenId);
    setTimeout(() => setCopiedScreen(null), 2000);
  };

  const applyPreset = (preset: 'standard' | 'leaderboard' | 'announcements' | 'ceremony') => {
    if (preset === 'standard') {
      ALL_SCREENS.forEach(s => handlePageChange(s.id, s.defaultPage));
    } else if (preset === 'leaderboard') {
      ALL_SCREENS.forEach(s => handlePageChange(s.id, 'leaderboard'));
    } else if (preset === 'announcements') {
      ALL_SCREENS.forEach(s => handlePageChange(s.id, 'announcements'));
    } else if (preset === 'ceremony') {
      handlePageChange(1, 'results');
      handlePageChange(2, 'leaderboard');
      handlePageChange(3, 'results');
      handlePageChange(4, 'leaderboard');
      handlePageChange(5, 'results');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Top Header & Global Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🖥️</span>
            <h1 className="text-2xl font-black font-heading text-gray-900 tracking-tight">
              Multi-Screen Display & Template Studio
            </h1>
          </div>
          <p className="text-sm text-gray-600 font-medium">
            Configure different pages and distinct announcement templates for each screen (Screen 1 to 5).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={launchAllScreens}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <span>🚀 Launch All 5 Screens</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => launchScreen(1)}
            className="flex items-center gap-2 text-xs font-bold shadow-md shadow-orange-500/20"
          >
            <span>🖥️ Open Screen 1</span>
          </Button>
        </div>
      </div>

      {/* ── Quick Scene Presets ── */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black text-amber-900 font-heading uppercase tracking-wide">
          <span>⚡ Quick Scene Presets:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset('standard')}
            className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-gray-800 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-sm"
          >
            🎯 Standard Multi-View
          </button>
          <button
            onClick={() => applyPreset('leaderboard')}
            className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-gray-800 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-sm"
          >
            🏆 All Leaderboards
          </button>
          <button
            onClick={() => applyPreset('announcements')}
            className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-gray-800 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-sm"
          >
            📢 All Announcements
          </button>
          <button
            onClick={() => applyPreset('ceremony')}
            className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-gray-800 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-sm"
          >
            🎖️ Championship Awards Mode
          </button>
        </div>
      </div>

      {/* ── Screens 1 through 5 Management Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {ALL_SCREENS.map(screen => {
          const currentPageId = screenPages[screen.id] || screen.defaultPage;
          const currentAnn = screenAnnouncements[screen.id] || getScreenAnnouncement(screen.id);
          const isAnnouncementsPage = currentPageId === 'announcements';

          return (
            <div
              key={screen.id}
              className="bg-white rounded-3xl border-2 border-gray-200 hover:border-black/30 p-5 shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                {/* Screen Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center font-black text-black font-heading text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {screen.id}
                    </span>
                    <div>
                      <h3 className="text-base font-black font-heading text-gray-900 leading-tight">
                        {screen.label}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live on Projector {screen.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyScreenLink(screen.id)}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all"
                      title="Copy Public Screen URL"
                    >
                      {copiedScreen === screen.id ? '✓ Copied' : '🔗 Copy'}
                    </button>
                    <button
                      onClick={() => launchScreen(screen.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                      title="Launch this screen in a clean new window"
                    >
                      <span>↗ Launch</span>
                    </button>
                  </div>
                </div>

                {/* Direct URL Tag */}
                <div className="bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200 mb-4 flex items-center justify-between text-xs font-mono text-gray-600">
                  <span className="truncate">/display?screen={screen.id}</span>
                  <span className="text-[10px] text-gray-400 font-sans font-bold">Projector URL</span>
                </div>

                {/* Page Selection for This Screen */}
                <div className="space-y-2 mb-4">
                  <label className="text-[11px] font-black uppercase text-gray-500 font-heading tracking-wider">
                    Select Active Page for {screen.label}:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DISPLAY_PAGES.map(page => {
                      const isSelected = currentPageId === page.id;
                      return (
                        <button
                          key={page.id}
                          onClick={() => handlePageChange(screen.id, page.id)}
                          className={`text-left px-2.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-black text-white border-black font-black shadow-sm'
                              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-medium text-xs'
                          }`}
                        >
                          <span>{page.icon}</span>
                          <span className="text-xs truncate">{page.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Screen-Specific Announcement Template Studio Section ── */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black uppercase text-amber-900 font-heading tracking-wider flex items-center gap-1">
                      <span>📢 {screen.label} Template:</span>
                    </label>
                    <button
                      onClick={() => openEditModal(screen.id)}
                      className="text-xs font-black text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1"
                    >
                      ✏️ Edit Template
                    </button>
                  </div>

                  {/* Pop-Art Mini Preview of This Screen's Announcement */}
                  <div className="bg-[#faf7f2] border-2 border-black rounded-2xl p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        currentAnn.priority === 'URGENT'
                          ? 'bg-red-500 text-white'
                          : currentAnn.priority === 'IMPORTANT'
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {currentAnn.priority}
                      </span>
                      {isAnnouncementsPage ? (
                        <span className="text-[10px] font-black text-emerald-600">● Showing Now</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">Ready in background</span>
                      )}
                    </div>
                    <div className="font-display font-black text-slate-950 text-sm uppercase leading-tight line-clamp-2">
                      {currentAnn.title}
                    </div>
                    <div className="text-[11px] text-slate-800 font-bold mt-1 line-clamp-2">
                      {currentAnn.message}
                    </div>
                  </div>

                  {/* Quick Preset Selector for this Screen */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Quick Template Presets for {screen.label}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ANNOUNCEMENT_PRESETS.slice(0, 4).map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuickTemplateApply(screen.id, p)}
                          className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all truncate max-w-[140px] ${
                            currentAnn.title === p.title
                              ? 'bg-amber-400 border-black text-black font-black'
                              : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-600'
                          }`}
                          title={p.title}
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Edit Announcement Template Modal ── */}
      {editingScreenId !== null && (
        <Modal
          isOpen={true}
          onClose={() => setEditingScreenId(null)}
          title={`✏️ Edit Template for Screen ${editingScreenId}`}
        >
          <div className="space-y-4">
            {/* Quick Presets Picker inside Modal */}
            <div>
              <label className="text-xs font-black uppercase text-gray-600 font-heading mb-1.5 block">
                Choose From Presets:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
                {ANNOUNCEMENT_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditForm({ ...p })}
                    className={`text-left p-2 rounded-lg border text-xs transition-all ${
                      editForm.title === p.title
                        ? 'bg-amber-400 border-black font-black text-black'
                        : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-bold truncate">{p.title}</div>
                  </button>
                ))}
              </div>
            </div>

            <FormField label="Announcement Headline / Title">
              <TextInput
                value={editForm.title}
                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value.toUpperCase() }))}
                placeholder="e.g. STARTS IN 10 MINS"
              />
            </FormField>

            <FormField label="Detailed Message">
              <TextArea
                value={editForm.message}
                onChange={e => setEditForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Message instructions for contenders..."
                rows={3}
              />
            </FormField>

            <FormField label="Priority / Urgency">
              <Select
                value={editForm.priority}
                onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value as any }))}
                options={[
                  { value: 'URGENT', label: '🚨 URGENT (Plays sound alert on projector)' },
                  { value: 'IMPORTANT', label: '⚠️ IMPORTANT' },
                  { value: 'NORMAL', label: 'ℹ️ NORMAL' },
                ]}
              />
            </FormField>

            {/* Live Pop-Art Preview inside Modal */}
            <div>
              <label className="text-xs font-black uppercase text-gray-600 font-heading mb-1 block">
                Live Template Preview for Screen {editingScreenId}:
              </label>
              <div className="bg-[#faf7f2] border-2 border-black rounded-2xl p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h4 className="font-display font-black text-slate-950 text-xl uppercase leading-tight">
                  {editForm.title || 'HEADLINE TITLE'}
                </h4>
                {editForm.message && (
                  <p className="text-xs text-slate-900 font-extrabold mt-1">
                    {editForm.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setEditingScreenId(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveScreenAnnouncementModal}>
                💾 Save & Broadcast to Screen {editingScreenId}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
