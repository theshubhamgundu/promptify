import React, { useState } from 'react';
import { Send, HandCoins, HelpCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';

interface ActionPanelProps {
  availableActions: string[];
  onAction: (type: string, params: any) => void;
  disabled: boolean;
}

export function ActionPanel({ availableActions, onAction, disabled }: ActionPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [params, setParams] = useState<any>({});

  const handleExecute = () => {
    if (!selectedAction) return;
    onAction(selectedAction, params);
    setSelectedAction(null);
    setParams({});
  };

  if (!selectedAction) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {availableActions.includes('MAKE_OFFER') && (
          <button onClick={() => setSelectedAction('MAKE_OFFER')} disabled={disabled} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-lg text-left transition-colors flex items-start space-x-3 disabled:opacity-50">
            <HandCoins className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="font-bold text-white text-sm">Make Offer</div>
              <div className="text-xs text-slate-400 mt-1">Propose terms to the opponent</div>
            </div>
          </button>
        )}
        {availableActions.includes('ASK_QUESTION') && (
          <button onClick={() => setSelectedAction('ASK_QUESTION')} disabled={disabled} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-lg text-left transition-colors flex items-start space-x-3 disabled:opacity-50">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-bold text-white text-sm">Ask Question</div>
              <div className="text-xs text-slate-400 mt-1">Discover hidden information</div>
            </div>
          </button>
        )}
        {availableActions.includes('COUNTER') && (
          <button onClick={() => setSelectedAction('COUNTER')} disabled={disabled} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-lg text-left transition-colors flex items-start space-x-3 disabled:opacity-50">
            <FileText className="w-5 h-5 text-purple-400" />
            <div>
              <div className="font-bold text-white text-sm">Counter-Offer</div>
              <div className="text-xs text-slate-400 mt-1">Respond with adjusted terms</div>
            </div>
          </button>
        )}
        {availableActions.includes('ACCEPT') && (
          <button onClick={() => { setSelectedAction('ACCEPT'); setParams({ confirmation: true }); }} disabled={disabled} className="bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-800 p-4 rounded-lg text-left transition-colors flex items-start space-x-3 disabled:opacity-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-bold text-emerald-400 text-sm">Accept Deal</div>
              <div className="text-xs text-slate-400 mt-1">Agree to current terms</div>
            </div>
          </button>
        )}
        {availableActions.includes('WALK_AWAY') && (
          <button onClick={() => { setSelectedAction('WALK_AWAY'); setParams({ confirmation: true }); }} disabled={disabled} className="bg-red-900/30 hover:bg-red-800/50 border border-red-800 p-4 rounded-lg text-left transition-colors flex items-start space-x-3 disabled:opacity-50">
            <XCircle className="w-5 h-5 text-red-400" />
            <div>
              <div className="font-bold text-red-400 text-sm">Walk Away</div>
              <div className="text-xs text-slate-400 mt-1">End negotiation without deal</div>
            </div>
          </button>
        )}
      </div>
    );
  }

  // Render form for selected action
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
      <h4 className="font-bold text-white mb-4 flex items-center space-x-2">
        <span>Execute: {selectedAction}</span>
      </h4>

      {(selectedAction === 'MAKE_OFFER' || selectedAction === 'COUNTER') && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Price / Value Proposal</label>
            <input type="text" onChange={e => setParams({...params, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" placeholder="e.g. $450,000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Additional Terms</label>
            <textarea onChange={e => setParams({...params, terms: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white h-20" placeholder="e.g. 3-year contract, 99.9% SLA..." />
          </div>
        </div>
      )}

      {selectedAction === 'ASK_QUESTION' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Your Question</label>
            <textarea onChange={e => setParams({...params, question: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white h-24" placeholder="What are your primary constraints regarding timeline?" />
          </div>
        </div>
      )}

      {(selectedAction === 'ACCEPT' || selectedAction === 'WALK_AWAY') && (
        <div className="text-amber-400 text-sm mb-4">
          Are you sure? This action is terminal and ends the negotiation immediately.
        </div>
      )}

      <div className="flex justify-end space-x-3 mt-6">
        <button onClick={() => setSelectedAction(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
        <button onClick={handleExecute} disabled={disabled} className="flex items-center space-x-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-sm font-bold disabled:opacity-50">
          <span>Confirm Action</span>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
