import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { EnvironmentPanel } from './EnvironmentPanel';
import { ObservationPanel } from './ObservationPanel';
import { ExperimentHistory } from './ExperimentHistory';
import { Hexagon, AlertTriangle, Fingerprint } from 'lucide-react';

interface EmergenceChallengeProps {
  challenge: any;
  challengeSession: any;
  onComplete: () => void;
}

export function EmergenceChallenge({ challenge, challengeSession, onComplete }: EmergenceChallengeProps) {
  const [session, setSession] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestObservation, setLatestObservation] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      // Note: emergence_sessions table doesn't exist in the database
      // This challenge type may not be fully implemented
      console.warn('EmergenceChallenge: emergence_sessions table does not exist');
      setSession(null);
      setActions([]);
    }
    loadSession();
  }, [challengeSession.id]);

  const handleAction = async (actionType: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: execErr } = await supabase.rpc('execute_emergence_action', {
        p_team_id: challengeSession.team_id,
        p_challenge_id: challenge.id,
        p_action_type: actionType
      });

      if (execErr) throw execErr;
      
      if (!data.success) {
        setError(data.error || 'Action failed');
      } else {
        // Update local state without full reload for speed
        setSession({
          ...session,
          current_state: data.currentState,
          current_score: data.currentScore,
          action_count: data.actionNumber
        });
        
        setLatestObservation(data.observation);
        
        // Unshift new action to top of history
        setActions([{
          id: `temp_${Date.now()}`,
          sequence_number: data.actionNumber,
          action_type: actionType,
          score_delta: data.scoreDelta,
          observation: data.observation,
          created_at: new Date().toISOString()
        }, ...actions]);
      }
    } catch (e: any) {
      setError(e.message || 'Error executing action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = async () => {
    try {
      await supabase
        .from('challenge_sessions')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', challengeSession.id);
      
      onComplete();
    } catch (e: any) {
      setError('Error finishing challenge: ' + e.message);
    }
  };

  if (!session) return <div className="p-8 text-white">Emergence challenge not available (database table missing)</div>;

  const availableActions = session.emergence_environments?.available_actions || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
            <Hexagon className="w-5 h-5 text-purple-500" />
            <span>Emergence: Unknown System</span>
          </h2>
          <p className="text-sm text-slate-400">Discover the hidden rules through experimentation. Maximize your score.</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-xs text-slate-500 mb-1 flex items-center">
            <Fingerprint className="w-3 h-3 mr-1" />
            Seed Variant: {session.seed}
          </div>
          <button 
            onClick={handleFinish}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm border border-slate-700 transition-colors"
          >
            End Experiment Early
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-sm flex items-center px-6 border-b border-slate-800">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Environment & Actions */}
        <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-900/30">
          <div className="p-6 shrink-0">
            <EnvironmentPanel 
              state={session.current_state} 
              score={session.current_score} 
              actionCount={session.action_count} 
            />
          </div>
          
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Available Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              {availableActions.map((action: string) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={isSubmitting}
                  className="bg-slate-800 hover:bg-purple-900/30 hover:border-purple-500/50 border border-slate-700 p-4 rounded-lg text-center transition-all disabled:opacity-50 group"
                >
                  <div className="font-bold text-white group-hover:text-purple-400 tracking-wide">{action}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Observations & History */}
        <div className="w-1/2 flex flex-col bg-slate-900/50 overflow-hidden relative">
          {latestObservation && (
            <div className="shrink-0 p-6 z-10">
              <ObservationPanel text={latestObservation} scoreDelta={actions[0]?.score_delta} />
            </div>
          )}
          
          <div className="flex-1 overflow-hidden">
            <ExperimentHistory actions={actions} />
          </div>
        </div>
      </div>
    </div>
  );
}
