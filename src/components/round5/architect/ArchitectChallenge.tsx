import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ArchitectureBuilder } from './ArchitectureBuilder';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ArchitectChallengeProps {
  challenge: any;
  challengeSession: any;
  onComplete: () => void;
}

export function ArchitectChallenge({ challenge, challengeSession, onComplete }: ArchitectChallengeProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scenario = challenge.configuration?.scenario;

  const handleSubmit = async (graph: any, configs: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: submitErr } = await supabase.rpc('submit_architect_design', {
        p_team_id: challengeSession.team_id,
        p_challenge_id: challenge.id,
        p_round_session_id: challengeSession.round_session_id,
        p_architecture_graph: graph,
        p_component_configs: configs
      });

      if (submitErr) throw submitErr;
      
      if (!data.success) {
        setError(data.error || 'Submission failed');
      } else if (!data.isValid) {
        setError('Validation errors: ' + JSON.parse(data.validationErrors).join(', '));
      } else if (data.isCompleted) {
        onComplete();
      } else {
        setError(`Attempt ${data.attemptNumber} recorded. Still not complete.`);
      }
    } catch (e: any) {
      setError(e.message || 'Error submitting architecture');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top section: Scenario info */}
      <div className="p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-white mb-2">{scenario?.title || 'System Architecture'}</h2>
        <p className="text-sm text-slate-300 mb-4">{scenario?.business_objective}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <h4 className="font-semibold text-cyan-400 mb-2 flex items-center"><ShieldCheck className="w-4 h-4 mr-1"/> Constraints</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              {scenario?.constraints?.map((c: any, i: number) => (
                <li key={i}><span className="font-medium">{c.name}:</span> {c.value}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <h4 className="font-semibold text-amber-400 mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-1"/> Failure Scenarios to Handle</h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              {scenario?.failure_scenarios?.slice(0, 4).map((f: string, i: number) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 text-red-400 p-3 text-sm flex items-center px-6">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Main section: Builder */}
      <div className="flex-1 overflow-hidden relative">
        <ArchitectureBuilder 
          availableComponents={scenario?.available_components || []} 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
