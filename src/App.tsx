import { useState, useEffect, useRef } from 'react';
import Layout, { type Page } from './components/Layout';
import { Toast, SessionAlert } from './components/ui';
import Login from './pages/Login';
import Verification from './pages/Verification';
import Dashboard from './pages/Dashboard';
import RoundsOverview from './pages/RoundsOverview';
import GenericRound from './pages/GenericRound';
import FinalResults from './pages/FinalResults';
import Leaderboard from './pages/Leaderboard';
import MyProgress from './pages/MyProgress';
import Submissions from './pages/Submissions';
import Team from './pages/Team';
import HelpRules from './pages/HelpRules';
import AdminDashboard from './pages/admin/AdminDashboard';
import EventManager from './pages/admin/EventManager';
import TeamManager from './pages/admin/TeamManager';
import RoundManager from './pages/admin/RoundManager';
import AdminLeaderboard from './pages/admin/AdminLeaderboard';
import ActivityLogViewer from './pages/admin/ActivityLogViewer';
import ParticipantManager from './pages/admin/ParticipantManager';
import VerificationManager from './pages/admin/VerificationManager';
import SessionManager from './pages/admin/SessionManager';
import TeamDetail from './pages/admin/TeamDetail';
import SubmissionsReview from './pages/admin/SubmissionsReview';
import Announcements from './pages/admin/Announcements';
import LiveMonitor from './pages/admin/LiveMonitor';
import SnapshotManager from './pages/admin/SnapshotManager';
import QuizManager from './pages/admin/QuizManager';
import QuizRoundSimple from './pages/QuizRoundSimple';
import QuizResults from './pages/QuizResults';
import QuizRound from './pages/QuizRound';
import PromptHeist from './pages/PromptHeist';
import PromptHeistRound from './pages/PromptHeistRound';
import AdminLayout from './components/AdminLayout';
import FullscreenEnforcer from './components/FullscreenEnforcer';
import { SyncEngine } from './lib/sync-engine';
import { IntegrityMonitor } from './lib/integrity-monitor';
import { supabase } from './lib/supabase';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useSessionHeartbeat } from './hooks/useSessionHeartbeat';
import { useTeamStore } from './stores/teamStore';

// ── Page transition wrapper ───────────────────────────────────────────
function PageView({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  return (
    <div key={pageKey} className="page-enter h-full">
      {children}
    </div>
  );
}

export default function App() {
  // Initialize authState from localStorage
  const [authState, setAuthState] = useState<'login' | 'verification' | 'app'>(() => {
    const saved = localStorage.getItem('authState');
    return (saved === 'app' || saved === 'verification') ? saved : 'login';
  });
  const [page, setPage]           = useState<Page>('dashboard');
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [sessionAlert, setSessionAlert] = useState(false);
  const prevPage = useRef<string>('');
  const currentTeam = useTeamStore(s => s.currentTeam);
  
  // Strict violation blocking
  const [violation, setViolation] = useState<string | null>(null);
  
  // Real reliability hooks
  const isOnline = useConnectionStatus();
  
  // Initialize heartbeat if in the app
  useSessionHeartbeat();
  
  // Save authState to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('authState', authState);
  }, [authState]);
  
  // Initialize sync engine + integrity monitor once
  useEffect(() => {
    SyncEngine.init();
    IntegrityMonitor.init(currentTeam?.id, undefined, (reason) => {
      setViolation(reason);
    });

    if (currentTeam?.id) {
      // Listen for team updates (like being frozen)
      const teamSub = supabase.channel('team-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${currentTeam.id}` }, (payload) => {
          if (payload.new.is_frozen) {
            setViolation('TEAM_FROZEN');
          }
          useTeamStore.getState().setCurrentTeam(payload.new as any);
        })
        .subscribe();

      // Check initial state
      if (currentTeam.is_frozen) {
        setViolation('TEAM_FROZEN');
      }

      return () => {
        teamSub.unsubscribe();
      };
    }
  }, [currentTeam?.id]);

  const navigate = (p: Page) => {
    prevPage.current = page;
    setPage(p);
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ msg, type });
  };

  if (violation) {
    return (
      <div className="fixed inset-0 z-[99999] bg-red-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 bg-black/80 border border-red-500 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] backdrop-blur-md">
          <div className="w-20 h-20 bg-red-900/50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
            <span className="text-4xl animate-pulse">🔒</span>
          </div>
          <h1 className="text-3xl font-black font-heading text-red-500 mb-4 tracking-widest uppercase">
            {violation === 'TEAM_FROZEN' ? 'TEAM FROZEN' : 'Access Suspended'}
          </h1>
          <p className="text-sm text-red-200/80 mb-6 leading-relaxed">
            {violation === 'TEAM_FROZEN' 
              ? 'Your team has been frozen by the automated integrity system due to excessive security violations. An admin must review your activity.' 
              : violation}
            <br /><br />
            {violation !== 'TEAM_FROZEN' && 'To ensure fair competition, you must disable all browser extensions before participating. Please disable them and refresh the page.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg uppercase tracking-wider"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <Login 
        onLogin={(isAdmin) => {
          if (isAdmin) {
            setAuthState('app');
            setPage('admin');
            showToast('Admin login successful.', 'success');
          } else {
            setAuthState('verification');
          }
        }} 
      />
    );
  }

  if (authState === 'verification') {
    return <Verification onApprove={() => { setAuthState('app'); showToast('Verification complete — competition access granted!', 'success'); }} />;
  }

  const renderPage = () => {
    const key = page; // used as key for transition

    const content = (() => {
      if (page === 'dashboard')       return <Dashboard navigate={navigate} />;
      if (page === 'rounds')          return <RoundsOverview navigate={navigate} />;
      if (page.startsWith('quiz-'))   {
        const roundId = page.replace('quiz-', '');
        return <QuizRound roundId={roundId} navigate={navigate} />;
      }
      if (page.startsWith('quiz-results-')) {
        const roundId = page.replace('quiz-results-', '');
        return <QuizResults roundId={roundId} navigate={navigate} />;
      }
      if (page.startsWith('prompt-heist-'))  {
        const roundId = page.replace('prompt-heist-', '');
        return <PromptHeist roundId={roundId} navigate={navigate} />;
      }
      if (page.startsWith('round-'))  {
        const roundId = page.replace('round-', '');
        return <GenericRound roundId={roundId} navigate={navigate} />;
      }
      if (page === 'final-results')   return <FinalResults navigate={navigate} />;
      if (page === 'leaderboard')     return <Leaderboard />;
      if (page === 'progress')        return <MyProgress />;
      if (page === 'submissions')     return <Submissions />;
      if (page === 'team')            return <Team />;
      if (page === 'help')            return <HelpRules />;
      if (page === 'admin')           return <AdminDashboard navigate={navigate} />;
      if (page === 'admin-events')    return <EventManager navigate={navigate} />;
      if (page === 'admin-teams')     return <TeamManager navigate={navigate} />;
      if (page.startsWith('admin-team-')) {
        const teamId = page.replace('admin-team-', '');
        return <TeamDetail teamId={teamId} navigate={navigate} />;
      }
      if (page === 'admin-rounds')    return <RoundManager navigate={navigate} />;
      if (page === 'admin-leaderboard') return <AdminLeaderboard navigate={navigate} />;
      if (page === 'admin-logs')      return <ActivityLogViewer navigate={navigate} />;
      if (page === 'admin-participants') return <ParticipantManager navigate={navigate} />;
      if (page === 'admin-verification') return <VerificationManager navigate={navigate} />;
      if (page === 'admin-sessions')     return <SessionManager navigate={navigate} />;
      if (page === 'admin-monitor')       return <LiveMonitor navigate={navigate} />;
      if (page === 'admin-snapshots')     return <SnapshotManager navigate={navigate} />;
      if (page === 'admin-submissions')  return <SubmissionsReview navigate={navigate} />;
      if (page === 'admin-announcements') return <Announcements navigate={navigate} />;
      if (page === 'admin-quiz')         return <QuizManager />;
      
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Page "{page}" coming soon
        </div>
      );
    })();

    return <PageView pageKey={key}>{content}</PageView>;
  };

  const isAdminPage = page.startsWith('admin');
  const isRoundPage = page.startsWith('quiz-') || page.startsWith('quiz-results-') || page.startsWith('prompt-heist-') || page.startsWith('round-');

  return (
    <>
      {isAdminPage ? (
        <AdminLayout page={page} navigate={navigate}>
          {renderPage()}
        </AdminLayout>
      ) : isRoundPage ? (
        <FullscreenEnforcer>
          {renderPage()}
        </FullscreenEnforcer>
      ) : (
        <FullscreenEnforcer>
          <Layout
            page={page}
            navigate={navigate}
            offline={!isOnline}
            onSessionAlert={() => setSessionAlert(true)}
          >
            {renderPage()}
          </Layout>
        </FullscreenEnforcer>
      )}

      {/* Session alert overlay */}
      {sessionAlert && <SessionAlert onClose={() => setSessionAlert(false)} />}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
