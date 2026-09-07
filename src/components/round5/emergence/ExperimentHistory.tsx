import React from 'react';
import { History, ArrowRight } from 'lucide-react';

interface ExperimentHistoryProps {
  actions: any[];
}

export function ExperimentHistory({ actions }: ExperimentHistoryProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900/30">
      <div className="p-4 border-b border-slate-800/50 flex items-center text-slate-400">
        <History className="w-4 h-4 mr-2" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Experiment Log</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {actions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No actions taken yet. Begin experimentation.
          </div>
        ) : (
          actions.map(action => (
            <div key={action.id} className="bg-slate-800/80 rounded border border-slate-700/50 p-3 flex items-center text-sm">
              <div className="w-8 text-xs font-mono text-slate-500">#{action.sequence_number}</div>
              
              <div className="w-32 font-bold text-white">{action.action_type}</div>
              
              <ArrowRight className="w-4 h-4 text-slate-600 mx-2 flex-none" />
              
              <div className="flex-1 truncate text-slate-400 italic pr-4" title={action.observation}>
                {action.observation}
              </div>
              
              <div className={`font-mono font-bold w-12 text-right flex-none ${
                action.score_delta > 0 ? 'text-emerald-400' : 
                action.score_delta < 0 ? 'text-red-400' : 
                'text-slate-500'
              }`}>
                {action.score_delta > 0 ? '+' : ''}{action.score_delta}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
