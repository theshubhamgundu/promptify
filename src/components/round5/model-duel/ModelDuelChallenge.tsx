import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { TaskPanel } from './TaskPanel';
import { RoutingBuilder } from './RoutingBuilder';
import { ShieldCheck, Target, SplitSquareHorizontal } from 'lucide-react';

interface ModelDuelChallengeProps {
  challenge: any;
  challengeSession: any;
  onComplete: () => void;
}

export function ModelDuelChallenge({ challenge, challengeSession, onComplete }: ModelDuelChallengeProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ANALYSIS' | 'ROUTING'>('ANALYSIS');

  useEffect(() => {
    async function loadTasks() {
      // Note: model_duel_tasks table doesn't exist in the database
      // Using empty array for now - this challenge type may not be fully implemented
      console.warn('ModelDuelChallenge: model_duel_tasks table does not exist');
      setTasks([]);
    }
    loadTasks();
  }, [challenge.id]);

  const handleSubmit = async (rules: any[], identifications: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: submitErr } = await supabase.rpc('submit_model_duel_strategy', {
        p_team_id: challengeSession.team_id,
        p_challenge_id: challenge.id,
        p_round_session_id: challengeSession.round_session_id,
        p_routing_rules: rules,
        p_model_identifications: identifications
      });

      if (submitErr) throw submitErr;
      
      if (!data.success) {
        setError(data.error || 'Submission failed');
      } else {
        onComplete();
      }
    } catch (e: any) {
      setError(e.message || 'Error submitting strategy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Model Duel</h2>
          <p className="text-sm text-slate-400">Analyze the anonymized outputs and build a routing strategy.</p>
        </div>
        
        <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button 
            onClick={() => setActiveTab('ANALYSIS')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${activeTab === 'ANALYSIS' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800' : 'text-slate-400 hover:text-white'}`}
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            <span>Analysis</span>
          </button>
          <button 
            onClick={() => setActiveTab('ROUTING')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${activeTab === 'ROUTING' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800' : 'text-slate-400 hover:text-white'}`}
          >
            <Target className="w-4 h-4" />
            <span>Routing Strategy</span>
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-sm flex items-center px-6 border-b border-slate-800">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'ANALYSIS' ? (
          <TaskPanel tasks={tasks} />
        ) : (
          <RoutingBuilder 
            taskTypes={challenge.configuration?.task_types || []}
            models={Object.keys(challenge.configuration?.models || {})}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
