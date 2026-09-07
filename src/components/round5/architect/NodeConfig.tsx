import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface NodeConfigProps {
  node: { id: string, type: string, config: any };
  onSave: (config: any) => void;
  onClose: () => void;
}

export function NodeConfig({ node, onSave, onClose }: NodeConfigProps) {
  const [config, setConfig] = useState<any>(node.config || {});

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-white">{node.type} Configuration</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Purpose / Instructions</label>
          <textarea 
            value={config.purpose || ''}
            onChange={e => setConfig({...config, purpose: e.target.value})}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 h-24"
            placeholder="What does this component do?"
          />
        </div>

        {node.type === 'LLM' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Model Selection</label>
              <select 
                value={config.model || ''}
                onChange={e => setConfig({...config, model: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500"
              >
                <option value="">Select a model...</option>
                <option value="gpt-4o">GPT-4o (High capability, slower)</option>
                <option value="gpt-4o-mini">GPT-4o-mini (Fast, cheap)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Temperature ({config.temperature || 0.7})</label>
              <input 
                type="range" min="0" max="1" step="0.1"
                value={config.temperature || 0.7}
                onChange={e => setConfig({...config, temperature: parseFloat(e.target.value)})}
                className="w-full"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Fallback Strategy (On Failure)</label>
          <select 
            value={config.fallback || 'FAIL'}
            onChange={e => setConfig({...config, fallback: e.target.value})}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500"
          >
            <option value="FAIL">Fail the pipeline</option>
            <option value="RETRY">Retry up to 3 times</option>
            <option value="HUMAN">Escalate to human</option>
            <option value="IGNORE">Ignore and continue</option>
          </select>
        </div>
      </div>

      <div className="pt-4 mt-auto">
        <button 
          onClick={handleSave}
          className="w-full flex justify-center items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save Config</span>
        </button>
      </div>
    </div>
  );
}
