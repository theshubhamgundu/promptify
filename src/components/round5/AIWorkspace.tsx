import React, { useState } from 'react';
import { Send, Loader2, KeyRound, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AIProvider } from '../../lib/byok-service';
import { AIWorkspaceService } from '../../lib/services/ai-workspace-service';

interface AIWorkspaceProps {
  eventId: string;
  roundId: string;
  challengeId: string;
  roundSessionId: string;
  challengeSessionId: string;
  teamId: string;
  participantId: string;
  challengeConfig: any;
  onNewInteraction: () => void;
}

export function AIWorkspace({
  eventId,
  roundId,
  challengeId,
  roundSessionId,
  challengeSessionId,
  teamId,
  participantId,
  challengeConfig,
  onNewInteraction
}: AIWorkspaceProps) {
  const byok = challengeConfig?.byok;
  const allowedProviders = byok?.required_providers || [];
  
  const [provider, setProvider] = useState<AIProvider>(allowedProviders[0] || 'OPENAI');
  const [model, setModel] = useState<string>('gpt-4o-mini'); // Should be derived from provider
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const isByokValid = AIWorkspaceService.validateBYOK(provider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    if (!isByokValid) {
      setError(`No valid API key found for ${provider}. Please configure it in your settings.`);
      return;
    }

    const validateRes = AIWorkspaceService.validateProvider(challengeConfig, provider, model);
    if (!validateRes.valid) {
      setError(validateRes.error || 'Invalid provider or model');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setLastResponse(null);

    const request = {
      model,
      messages: [{ role: 'user' as const, content: prompt }]
    };

    const res = await AIWorkspaceService.executeAndRecordRequest(
      eventId,
      roundId,
      challengeId,
      roundSessionId,
      challengeSessionId,
      teamId,
      participantId,
      provider,
      model,
      prompt,
      request
    );

    setIsSubmitting(false);

    if (res.success && res.response) {
      setLastResponse(res.response.content || '');
      setPrompt('');
      onNewInteraction(); // Notify parent to refresh prompt sheet
    } else {
      setError(res.error || 'Request failed');
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-white">
      <div className="p-4 border-b border-slate-200 flex flex-col space-y-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <span>AI Workspace</span>
            <ShieldCheck className="w-4 h-4 text-cyan-600" title="Secure BYOK Environment" />
          </h2>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Status:</span>
            {isByokValid ? (
              <span className="flex items-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
              </span>
            ) : (
              <span className="flex items-center text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                <KeyRound className="w-3 h-3 mr-1" /> Key Required
              </span>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProvider)}
            className="flex-1 bg-white border border-slate-200 rounded-md text-sm p-2 text-slate-900 outline-none focus:border-cyan-500 shadow-sm"
          >
            {allowedProviders.map((p: string) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input 
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-md text-sm p-2 text-slate-900 outline-none focus:border-cyan-500 shadow-sm"
            placeholder="Model (e.g. gpt-4o)"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
        {lastResponse && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap shadow-sm">
            <div className="text-xs text-cyan-600 mb-2 font-mono">Response from {provider}</div>
            {lastResponse}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
            placeholder="Type your prompt... (Cmd+Enter to send)"
            className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-12 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-cyan-500 resize-none h-32 shadow-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim() || !isByokValid}
            className="absolute bottom-3 right-3 p-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white rounded-md transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
