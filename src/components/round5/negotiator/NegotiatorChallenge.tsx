import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { ActionPanel } from './ActionPanel';
import { NegotiationTimeline } from './NegotiationTimeline';
import { StatePanel } from './StatePanel';
import { Handshake, AlertTriangle, ShieldCheck } from 'lucide-react';

interface NegotiatorChallengeProps {
  challenge: any;
  challengeSession: any;
  onComplete: () => void;
}

export function NegotiatorChallenge({ challenge, challengeSession, onComplete }: NegotiatorChallengeProps) {
  const [session, setSession] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      // Note: negotiation_sessions table doesn't exist in the database
      // This challenge type may not be fully implemented
      console.warn('NegotiatorChallenge: negotiation_sessions table does not exist');
      setSession(null);
      setActions([]);
    }
    loadSession();
  }, [challengeSession.id]);

  const handleAction = async (actionType: string, parameters: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: execErr } = await supabase.rpc('execute_negotiation_action', {
        p_team_id: challengeSession.team_id,
        p_challenge_id: challenge.id,
        p_action_type: actionType,
        p_parameters: parameters
      });

      if (execErr) throw execErr;
      
      if (!data.success) {
        setError(data.error || 'Action failed');
      } else {
        // Session reloaded, check if complete
        if (data.isTerminal) {
          onComplete();
        }
      }
    } catch (e: any) {
      setError(e.message || 'Error executing action');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) return <div className="p-8 text-white">Negotiation challenge not available (database table missing)</div>;

  const scenario = session.negotiation_scenarios;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
          <Handshake className="w-5 h-5 text-cyan-500" />
          <span>{scenario?.title || 'Negotiation'}</span>
        </h2>
        <p className="text-sm text-slate-300">{scenario?.description}</p>
      </div>
      
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-sm flex items-center px-6 border-b border-slate-800">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Middle Panel - State & Actions */}
        <div className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-900/30 overflow-y-auto p-6 space-y-6">
          <StatePanel session={session} scenario={scenario} />
          
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Available Actions</h3>
            <ActionPanel 
              availableActions={scenario?.available_actions || []} 
              onAction={handleAction} 
              disabled={isSubmitting || session.status !== 'ACTIVE'} 
            />
          </div>
        </div>

        {/* Right Panel - Timeline */}
        <div className="w-1/2 flex flex-col bg-slate-900/50 overflow-hidden">
          <NegotiationTimeline actions={actions} />
        </div>
      </div>
    </div>
  );
}
