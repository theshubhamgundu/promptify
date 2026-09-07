import React from 'react';
import { Activity, Zap, Box, Hexagon, Database, Cpu } from 'lucide-react';

interface EnvironmentPanelProps {
  state: any;
  score: number;
  actionCount: number;
}

export function EnvironmentPanel({ state, score, actionCount }: EnvironmentPanelProps) {
  // Try to map resources to icons
  const getIcon = (key: string) => {
    switch (key) {
      case 'energy': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'materials': return <Box className="w-4 h-4 text-slate-400" />;
      case 'components': return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'output': return <Hexagon className="w-4 h-4 text-purple-400" />;
      default: return <Database className="w-4 h-4 text-slate-500" />;
    }
  };

  // Filter out internal state metadata
  const resources = Object.entries(state).filter(([k]) => !['action_count', 'last_action'].includes(k));

  return (
    <div className="space-y-6">
      {/* HUD Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center shadow-inner">
          <div className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-1">System Score</div>
          <div className={`text-4xl font-black ${score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {score}
          </div>
        </div>
        
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center shadow-inner">
          <div className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-1">Actions Taken</div>
          <div className="text-4xl font-black text-cyan-400">
            {actionCount}
          </div>
        </div>
      </div>

      {/* Resource Meters */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <h3 className="font-bold text-white mb-4 flex items-center text-sm">
          <Activity className="w-4 h-4 mr-2 text-cyan-500" />
          System Resources
        </h3>
        
        <div className="space-y-4">
          {resources.map(([key, val]: any) => (
            <div key={key} className="flex items-center">
              <div className="w-8 flex justify-center">{getIcon(key)}</div>
              <div className="w-32 text-sm font-medium text-slate-300 capitalize">{key}</div>
              <div className="flex-1 mx-4 h-2 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    val <= 5 ? 'bg-red-500' : 
                    val > 50 ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (val / 100) * 100))}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm font-mono font-bold text-white">
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
