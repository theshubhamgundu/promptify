// BYOK Connect Component
// Secure interface for participants to connect their AI provider

import { useState } from 'react';
import { FormField, Select } from './ui';
import { ShieldIcon, CheckCircleIcon } from './icons';
import { AIProvider, validateBYOKKey, testBYOKConnection, byokSession, BYOKConfig } from '../lib/byok-service';

interface BYOKConnectProps {
  config: BYOKConfig;
  teamId?: string;
  roundSessionId?: string;
  challengeId?: string;
  onConnected: (provider: AIProvider) => void;
  onCancel: () => void;
}

export function BYOKConnect({
  config,
  teamId,
  roundSessionId,
  challengeId,
  onConnected,
  onCancel,
}: BYOKConnectProps) {
  const [provider, setProvider] = useState<AIProvider>(config.required_providers[0]);
  const [apiKey, setApiKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const providerLabels: Record<AIProvider, string> = {
    OPENAI: 'OpenAI',
    ANTHROPIC: 'Anthropic',
    GOOGLE: 'Google (Gemini)',
    MISTRAL: 'Mistral AI',
    COHERE: 'Cohere',
    GROQ: 'Groq',
  };

  const providerOptions = config.required_providers.map(p => ({
    value: p,
    label: providerLabels[p],
  }));

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setValidating(true);
    setError(null);
    setTestResult(null);

    byokSession.setKey(provider, apiKey);

    if (teamId) {
      const result = await validateBYOKKey(provider, apiKey, teamId, roundSessionId, challengeId);
      setValidating(false);

      if (result.success) {
        onConnected(provider);
      } else {
        setError(result.error || 'Validation failed. Please check your API key.');
        setApiKey('');
        byokSession.clearKey(provider);
      }
    } else {
      setValidating(false);
      onConnected(provider);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    const result = await testBYOKConnection(provider, apiKey);
    setTesting(false);

    if (result.success) {
      setTestResult(result.message);
      setError(null);
    } else {
      setError(result.message);
      setTestResult(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim() && !validating) {
      handleValidate();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md animate-scale-in">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connect AI Provider</h2>
            <p className="text-xs text-gray-500">
              Configure your API key to unlock AI-powered challenges and features
            </p>
          </div>

          {/* Security Notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <ShieldIcon className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-green-900 mb-0.5">🔒 Your Key is Secure</div>
              <div className="text-[11px] text-green-700 leading-snug">
                Your API key is <strong>encrypted and stored locally</strong> in your browser. It persists across sessions but <strong>never leaves your device</strong> until you make an API request. You can safely logout and login - your key will be remembered.
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <FormField label="Select AI Provider">
            <Select
              value={provider}
              onChange={(value) => setProvider(value as AIProvider)}
              options={providerOptions}
              disabled={config.required_providers.length === 1 || validating}
            />
          </FormField>

          {/* API Key Input */}
          <FormField label="API Key">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-16 bg-gray-50 border border-gray-200 rounded-lg focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono text-xs placeholder:text-gray-400 disabled:opacity-50"
                disabled={validating}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700 font-medium rounded hover:bg-gray-100 transition-colors"
                disabled={validating}
              >
                👁️ {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              ⓘ Stored in memory only — never saved to our servers
            </p>
          </FormField>

          {/* Configuration Info */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-600 mb-2 uppercase tracking-wide">
              Usage Limits for This Challenge
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span>🔢</span> API Calls
                </span>
                <span className="font-bold text-gray-900">{config.max_requests} requests</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span>💬</span> Total Tokens
                </span>
                <span className="font-bold text-gray-900">{(config.max_total_tokens / 1000).toFixed(0)}K tokens</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span>📝</span> Per Request
                </span>
                <span className="font-bold text-gray-900">{(config.max_tokens_per_request / 1000).toFixed(1)}K tokens</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span>🛠️</span> Tool Calling
                </span>
                <span className={`font-bold ${config.allowed_tools ? 'text-green-600' : 'text-gray-400'}`}>
                  {config.allowed_tools ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
            </div>
            {config.allowed_models.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-gray-600 mb-1.5 text-[10px] font-semibold flex items-center gap-1">
                  <span>🤖</span> Allowed Models:
                </div>
                <div className="flex flex-wrap gap-1">
                  {config.allowed_models.map(model => (
                    <span key={model} className="px-1.5 py-0.5 bg-white border border-indigo-100 rounded text-indigo-700 font-mono text-[9px]">
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-500 italic">
              💡 Tip: {config.max_total_tokens >= 50000 ? 'Generous limits - use wisely!' : 'Limited tokens - optimize your prompts!'}
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4" />
              {testResult}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {/* Test Connection Button */}
            {!teamId && (
              <button
                onClick={handleTestConnection}
                disabled={!apiKey.trim() || testing || validating}
                className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {testing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-700/30 border-t-blue-700 rounded-full animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    🔌 Test Connection
                  </>
                )}
              </button>
            )}
            
            {/* Main Actions */}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={validating || testing}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleValidate}
                disabled={!apiKey.trim() || validating || testing}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {validating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    {teamId ? 'Validate & Connect' : 'Save & Connect'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Help Link */}
          <div className="text-center pt-2 border-t border-gray-100">
            <div className="text-[10px] text-gray-400 mb-1.5">Need an API key?</div>
            {provider === 'OPENAI' && (
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Get OpenAI Key →
              </a>
            )}
            {provider === 'ANTHROPIC' && (
              <a 
                href="https://console.anthropic.com/settings/keys" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Get Anthropic Key →
              </a>
            )}
            {provider === 'GOOGLE' && (
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Get Google AI Key →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Success indicator component
export function BYOKConnected({ provider, onDisconnect }: { provider: AIProvider; onDisconnect: () => void }) {
  const providerLabels: Record<AIProvider, string> = {
    OPENAI: 'OpenAI',
    ANTHROPIC: 'Anthropic',
    GOOGLE: 'Google (Gemini)',
    MISTRAL: 'Mistral AI',
    COHERE: 'Cohere',
    GROQ: 'Groq',
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="w-4 h-4 text-green-600" />
        <div>
          <div className="text-xs font-semibold text-green-900">
            {providerLabels[provider]} Connected
          </div>
          <div className="text-[10px] text-green-600">API key active</div>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className="text-[10px] font-semibold text-green-700 hover:text-green-800 px-2 py-1 rounded hover:bg-green-100 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
