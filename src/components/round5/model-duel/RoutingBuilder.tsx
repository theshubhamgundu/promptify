import React, { useState } from 'react';
import { Send, Plus, Trash2 } from 'lucide-react';

interface RoutingBuilderProps {
  taskTypes: string[];
  models: string[];
  onSubmit: (rules: any[], identifications: any) => void;
  isSubmitting: boolean;
}

export function RoutingBuilder({ taskTypes, models, onSubmit, isSubmitting }: RoutingBuilderProps) {
  const [rules, setRules] = useState<any[]>(
    taskTypes.map(t => ({ task_type: t, selected_model: models[0] || 'MODEL_A', reasoning: '' }))
  );
  
  const [identifications, setIdentifications] = useState<any>({
    'MODEL_A': '',
    'MODEL_B': '',
    'MODEL_C': ''
  });

  const handleSubmit = () => {
    onSubmit(rules, identifications);
  };

  const availableRealModels = ['gpt-4o-mini', 'claude-3-haiku', 'gemini-2.0-flash'];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8 max-w-4xl mx-auto space-y-8">
      
      {/* Model Identification Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Model Identification</h3>
        <p className="text-sm text-slate-400 mb-6">Based on the analysis, which underlying model is which? (Optional but helps score)</p>
        
        <div className="grid grid-cols-3 gap-6">
          {models.map(m => (
            <div key={m} className="space-y-2">
              <label className="text-sm font-bold text-cyan-500">{m}</label>
              <select 
                value={identifications[m] || ''}
                onChange={e => setIdentifications({...identifications, [m]: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-cyan-500 outline-none"
              >
                <option value="">Unknown...</option>
                {availableRealModels.map(rm => (
                  <option key={rm} value={rm}>{rm}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Routing Strategy Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Routing Strategy</h3>
        <p className="text-sm text-slate-400 mb-6">Map incoming tasks to the best performing model. This will be tested against a hidden dataset.</p>

        <div className="space-y-4">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex space-x-4 items-start bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3 text-sm">
                  <span className="font-mono text-slate-500">IF task_type ==</span>
                  <span className="font-bold text-emerald-400 bg-emerald-950 px-2 py-1 rounded border border-emerald-900">{rule.task_type}</span>
                </div>
              </div>
              
              <div className="flex-none space-y-2 w-48">
                <div className="text-sm font-mono text-slate-500 mb-1">THEN ROUTE TO</div>
                <select 
                  value={rule.selected_model}
                  onChange={e => {
                    const newRules = [...rules];
                    newRules[idx].selected_model = e.target.value;
                    setRules(newRules);
                  }}
                  className="w-full bg-slate-900 border border-cyan-700/50 rounded-lg p-2 text-sm text-cyan-400 font-bold focus:border-cyan-500 outline-none"
                >
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 pb-12">
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full font-bold shadow-xl transition-all"
        >
          <span>Submit Strategy & Run Evaluation</span>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
