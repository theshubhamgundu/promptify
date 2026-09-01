// BYOK Connect Component
// Secure interface for participants to connect their AI provider

import { useState } from 'react';
import { Modal, Button, FormField, Select, TextInput } from './ui';
import { KeyIcon, CheckCircleIcon, AlertTriangleIcon, ShieldIcon } from './icons';
import { AIProvider, validateBYOKKey, byokSession, BYOKConfig } from '../lib/byok-service';

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
  const [error, setError] = useState<string | null>(null);
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

    // Store the key in memory immediately
    byokSession.setKey(provider, apiKey);

    if (teamId) {
      // Full server-side validation when in a challenge context
      const result = await validateBYOKKey(
        provider,
        apiKey,
        teamId,
        roundSessionId,
        challengeId
      );

      setValidating(false);

      if (result.success) {
        onConnected(provider);
      } else {
        setError(result.error || 'Validation failed. Please check your API key.');
        setApiKey('');
        byokSession.clearKey(provider);
      }
    } else {
      // Dashboard mode: just store in memory, skip server validation
      setValidating(false);
      onConnected(provider);
    }
  };

  return (
    <Modal onClose={onCancel} size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <KeyIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 font-heading mb-2">
            Connect AI Provider
          </h2>
          <p className="text-sm text-gray-600">
            This challenge requires you to bring your own API key
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-green-900 mb-1">Your Key is Secure</div>
              <div className="text-xs text-green-700 leading-relaxed">
                Your API key is <strong>never stored</strong> in our database or logs. 
                It's kept only in memory for this session and is validated securely 
                through our Edge Function.
              </div>
            </div>
          </div>
        </div>

        {/* Provider Selection */}
        <FormField label="AI Provider">
          <Select
            value={provider}
            onChange={(value) => setProvider(value as AIProvider)}
            options={providerOptions}
            disabled={config.required_providers.length === 1}
          />
        </FormField>

        {/* API Key Input */}
        <FormField 
          label="API Key"
          hint="Your key will only be kept in memory for this session"
        >
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${providerLabels[provider]} API key`}
              className="w-full px-4 py-3 pr-20 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100 outline-none transition-all font-mono text-sm"
              disabled={validating}
              autoComplete="off"
              data-1p-ignore // Disable password managers
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </FormField>

        {/* Configuration Info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
          <div className="font-bold text-gray-700 mb-2">Challenge Limits:</div>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <div>Max Requests: <strong className="text-gray-900">{config.max_requests}</strong></div>
            <div>Max Tokens: <strong className="text-gray-900">{config.max_total_tokens.toLocaleString()}</strong></div>
            <div>Per Request: <strong className="text-gray-900">{config.max_tokens_per_request.toLocaleString()} tokens</strong></div>
            <div>Tools: <strong className="text-gray-900">{config.allowed_tools ? 'Allowed' : 'Not Allowed'}</strong></div>
          </div>
          {config.allowed_models.length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-gray-600 mb-1">Allowed Models:</div>
              <div className="flex flex-wrap gap-1">
                {config.allowed_models.map(model => (
                  <span key={model} className="px-2 py-1 bg-white rounded text-gray-700 font-mono text-[10px]">
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="secondary"
            fullWidth
            disabled={validating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleValidate}
            fullWidth
            loading={validating}
            disabled={!apiKey.trim() || validating}
          >
            {validating ? 'Validating...' : 'Validate & Connect'}
          </Button>
        </div>

        {/* Help Links */}
        <div className="text-center pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Need an API key?</div>
          <div className="flex justify-center gap-4 text-xs">
            {provider === 'OPENAI' && (
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-orange-600 hover:text-orange-700 font-medium">
                Get OpenAI Key →
              </a>
            )}
            {provider === 'ANTHROPIC' && (
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-orange-600 hover:text-orange-700 font-medium">
                Get Anthropic Key →
              </a>
            )}
            {provider === 'GOOGLE' && (
              <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener" className="text-orange-600 hover:text-orange-700 font-medium">
                Get Google AI Key →
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
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
    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircleIcon className="w-6 h-6 text-green-600" />
        <div>
          <div className="text-sm font-bold text-green-900">
            Connected to {providerLabels[provider]}
          </div>
          <div className="text-xs text-green-700">Your API key is active for this session</div>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className="text-xs font-medium text-green-700 hover:text-green-800 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
