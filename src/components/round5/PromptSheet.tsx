import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Clock, Database, CheckCircle2, XCircle } from 'lucide-react';
import { PromptSheetService } from '../../lib/services/prompt-sheet-service';
import type { PromptSheetEntry } from '../../lib/services/ai-workspace-service';

interface PromptSheetProps {
  challengeSessionId: string;
  refreshTrigger: number; // Increment to force refresh
}

export function PromptSheet({ challengeSessionId, refreshTrigger }: PromptSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<PromptSheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!challengeSessionId) return;

    const loadEntries = async () => {
      setIsLoading(true);
      const { entries } = await PromptSheetService.getEntries(challengeSessionId);
      setEntries(entries);
      setIsLoading(false);
    };

    loadEntries();
  }, [challengeSessionId, refreshTrigger]);

  return (
    <div className={`flex flex-col transition-all duration-300 ${isExpanded ? 'h-96' : 'h-12'}`}>
      {/* Header / Toggle */}
      <div 
        className="h-12 flex-none flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Database className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-semibold text-white">Immutable Prompt Sheet</h3>
          <div className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700">
            {entries.length} interactions
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <span>Records are permanent and cannot be edited or deleted.</span>
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 flex flex-col space-y-3">
          {isLoading && entries.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">Loading interactions...</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">No AI interactions recorded yet.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-slate-500">#{entry.sequence_number}</span>
                    <span className="text-xs font-medium text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded">
                      {entry.provider} / {entry.model}
                    </span>
                    {entry.status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" title={entry.error_code || 'Failed'} />
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {entry.latency_ms}ms</span>
                    <span>{entry.prompt_word_count} words</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 rounded p-3 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Prompt</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono line-clamp-4">
                      {entry.prompt}
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded p-3 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Response</div>
                    <div className="text-sm text-slate-400 whitespace-pre-wrap line-clamp-4">
                      {entry.response || (entry.status === 'FAILED' ? <span className="text-red-400 italic">Request failed: {entry.error_code}</span> : <span className="italic text-slate-600">No response recorded</span>)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
