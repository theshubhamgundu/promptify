import React, { useEffect, useState } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ObservationPanelProps {
  text: string;
  scoreDelta: number | undefined;
}

export function ObservationPanel({ text, scoreDelta }: ObservationPanelProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const t = setTimeout(() => setAnimate(false), 300);
    return () => clearTimeout(t);
  }, [text]);

  const delta = scoreDelta || 0;

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-700 p-5 shadow-2xl transition-transform ${animate ? 'scale-[1.02]' : 'scale-100'}`}>
      <div className="flex items-start space-x-4">
        <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
          <Eye className="w-6 h-6 text-cyan-400" />
        </div>
        
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Latest Observation</div>
          <div className="text-lg text-white font-medium">{text}</div>
        </div>

        {scoreDelta !== undefined && (
          <div className={`flex flex-col items-end justify-center px-4 py-2 rounded-lg border ${
            delta > 0 ? 'bg-emerald-900/30 border-emerald-800/50' : 
            delta < 0 ? 'bg-red-900/30 border-red-800/50' : 
            'bg-slate-800 border-slate-700'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Score Delta</div>
            <div className={`flex items-center text-xl font-black font-mono ${
              delta > 0 ? 'text-emerald-400' : 
              delta < 0 ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {delta > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : 
               delta < 0 ? <TrendingDown className="w-4 h-4 mr-1" /> : 
               <Minus className="w-4 h-4 mr-1" />}
              {delta > 0 ? '+' : ''}{delta}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
