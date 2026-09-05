import React from 'react';
import { Target, AlertTriangle, Eye } from 'lucide-react';

interface StatePanelProps {
  session: any;
  scenario: any;
}

export function StatePanel({ session, scenario }: StatePanelProps) {
  const discovered = session.discovered_info || [];

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="font-bold text-white mb-3 flex items-center text-sm">
          <Target className="w-4 h-4 mr-2 text-cyan-400" />
          Your Objectives
        </h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {Object.entries(scenario?.participant_objectives || {}).map(([key, val]: any) => (
            <li key={key} className="flex space-x-2">
              <span className="text-slate-500 capitalize">{key}:</span>
              <span>{val}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="font-bold text-white mb-3 flex items-center text-sm">
          <AlertTriangle className="w-4 h-4 mr-2 text-amber-400" />
          Constraints
        </h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {Object.entries(scenario?.participant_constraints || {}).map(([key, val]: any) => (
            <li key={key} className="flex items-start space-x-2">
              <span className="text-slate-500 min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-amber-400/90">{val}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-900 rounded-lg border border-cyan-900/50 p-4 shadow-inner">
        <h3 className="font-bold text-white mb-3 flex items-center text-sm">
          <Eye className="w-4 h-4 mr-2 text-emerald-400" />
          Discovered Information
        </h3>
        {discovered.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No hidden information discovered yet. Ask strategic questions.</div>
        ) : (
          <ul className="space-y-3">
            {discovered.map((d: any, i: number) => (
              <li key={i} className="text-sm bg-slate-950 p-2 rounded border border-slate-800">
                <div className="text-xs text-slate-500 mb-1">Q: {d.question}</div>
                <div className="text-emerald-400/90">A: {d.response}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
