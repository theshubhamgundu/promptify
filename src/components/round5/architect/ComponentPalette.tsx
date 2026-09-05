import React from 'react';
import { X } from 'lucide-react';

interface ComponentPaletteProps {
  available: string[];
  onSelect: (type: string) => void;
  onClose: () => void;
}

export function ComponentPalette({ available, onSelect, onClose }: ComponentPaletteProps) {
  const defaultComponents = ['LLM', 'DATABASE', 'SEARCH', 'EXTERNAL_API', 'HUMAN_ESCALATION'];
  const components = available.length > 0 ? available : defaultComponents;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-white">Add Component</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {components.map(type => (
          <button 
            key={type}
            onClick={() => onSelect(type)}
            className="w-full text-left p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-cyan-500 transition-colors group"
          >
            <div className="font-bold text-slate-200 group-hover:text-cyan-400 mb-1">{type}</div>
            <div className="text-xs text-slate-400">Add to architecture pipeline</div>
          </button>
        ))}
        
        <button 
          onClick={() => onSelect('OUTPUT')}
          className="w-full text-left p-3 mt-4 rounded-lg border border-emerald-700 bg-emerald-900/20 hover:bg-emerald-800/40 transition-colors"
        >
          <div className="font-bold text-emerald-400 mb-1">OUTPUT</div>
          <div className="text-xs text-slate-400">Finalize the pipeline response</div>
        </button>
      </div>
    </div>
  );
}
