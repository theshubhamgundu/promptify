import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface TaskPanelProps {
  tasks: any[];
}

export function TaskPanel({ tasks }: TaskPanelProps) {
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);
  const task = tasks[selectedTaskIdx];

  if (!task) return <div className="p-8 text-slate-500 text-center">Loading tasks...</div>;

  return (
    <div className="flex h-full">
      {/* Sidebar - Task List */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
        {tasks.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSelectedTaskIdx(i)}
            className={`w-full text-left p-4 border-b border-slate-800 transition-colors ${
              selectedTaskIdx === i ? 'bg-cyan-950/30 border-l-2 border-l-cyan-500' : 'hover:bg-slate-800'
            }`}
          >
            <div className="text-xs text-slate-500 font-mono mb-1">{t.task_type.toUpperCase()}</div>
            <div className={`text-sm font-medium ${selectedTaskIdx === i ? 'text-white' : 'text-slate-300'}`}>
              {t.title}
            </div>
          </button>
        ))}
      </div>

      {/* Main Area - Task Details & Outputs */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-6">
        <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
          <h3 className="text-lg font-bold text-white mb-2">{task.title}</h3>
          <p className="text-slate-300 text-sm mb-4">{task.description}</p>
          <div className="bg-slate-950 rounded border border-slate-700 p-3 text-sm text-slate-400 font-mono">
            {task.input_data.input}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {task.model_outputs.map((mo: any, i: number) => (
            <div key={i} className="bg-slate-900 rounded-lg border border-slate-800 flex flex-col overflow-hidden">
              <div className="bg-slate-800 p-2 text-center border-b border-slate-700">
                <span className="text-sm font-bold text-cyan-400">{mo.model_label}</span>
              </div>
              <div className="p-4 flex-1 text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-y-auto bg-slate-950">
                {mo.output}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
