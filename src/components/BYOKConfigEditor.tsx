// BYOK Configuration Editor for Admins
// Used in Challenge configuration modal

import { useState } from 'react';
import { FormField, TextInput, Select, Toggle } from './ui';
import { AIProvider, BYOKConfig } from '../lib/byok-service';

interface BYOKConfigEditorProps {
  value: BYOKConfig | null;
  onChange: (config: BYOKConfig | null) => void;
}

export function BYOKConfigEditor({ value, onChange }: BYOKConfigEditorProps) {
  const [enabled, setEnabled] = useState(value?.enabled || false);
  const [config, setConfig] = useState<BYOKConfig>(value || {
    enabled: false,
    required_providers: ['OPENAI'],
    allowed_models: [],
    max_requests: 100,
    max_tokens_per_request: 4000,
    max_total_tokens: 50000,
    allowed_tools: false,
    allowed_web_access: false,
    timeout_seconds: 30,
  });

  const providerOptions = [
    { value: 'OPENAI', label: 'OpenAI' },
    { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
    { value: 'GOOGLE', label: 'Google (Gemini)' },
    { value: 'MISTRAL', label: 'Mistral AI' },
    { value: 'COHERE', label: 'Cohere' },
    { value: 'GROQ', label: 'Groq' },
  ];

  const updateConfig = (updates: Partial<BYOKConfig>) => {
    const newConfig = { ...config, ...updates, enabled };
    setConfig(newConfig);
    onChange(enabled ? newConfig : null);
  };

  const handleEnabledChange = (newEnabled: boolean) => {
    setEnabled(newEnabled);
    if (newEnabled) {
      onChange({ ...config, enabled: true });
    } else {
      onChange(null);
    }
  };

  const handleProviderToggle = (provider: AIProvider) => {
    const current = config.required_providers;
    const newProviders = current.includes(provider)
      ? current.filter(p => p !== provider)
      : [...current, provider];
    
    if (newProviders.length === 0) return; // Must have at least one provider
    
    updateConfig({ required_providers: newProviders });
  };

  return (
    <div className="space-y-4">
      {/* Enable BYOK */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div>
          <div className="text-sm font-bold text-gray-900">Enable BYOK (Bring Your Own Key)</div>
          <div className="text-xs text-gray-600 mt-0.5">
            Participants will provide their own AI API keys
          </div>
        </div>
        <Toggle checked={enabled} onChange={handleEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-4 pl-4 border-l-4 border-orange-200">
          {/* Providers */}
          <div>
            <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Allowed Providers
            </div>
            <div className="grid grid-cols-2 gap-2">
              {providerOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleProviderToggle(value as AIProvider)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.required_providers.includes(value as AIProvider)
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Allowed Models */}
          <FormField 
            label="Allowed Models (comma-separated)"
            hint="Leave empty to allow all models. E.g., gpt-4,gpt-3.5-turbo"
          >
            <TextInput
              value={config.allowed_models.join(', ')}
              onChange={(value) => {
                const models = value.split(',').map(m => m.trim()).filter(Boolean);
                updateConfig({ allowed_models: models });
              }}
              placeholder="gpt-4, gpt-3.5-turbo, claude-3-sonnet"
            />
          </FormField>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Max Requests">
              <TextInput
                type="number"
                value={config.max_requests.toString()}
                onChange={(value) => updateConfig({ max_requests: parseInt(value) || 100 })}
                min="1"
              />
            </FormField>

            <FormField label="Max Total Tokens">
              <TextInput
                type="number"
                value={config.max_total_tokens.toString()}
                onChange={(value) => updateConfig({ max_total_tokens: parseInt(value) || 50000 })}
                min="100"
              />
            </FormField>

            <FormField label="Tokens Per Request">
              <TextInput
                type="number"
                value={config.max_tokens_per_request.toString()}
                onChange={(value) => updateConfig({ max_tokens_per_request: parseInt(value) || 4000 })}
                min="100"
              />
            </FormField>

            <FormField label="Timeout (seconds)">
              <TextInput
                type="number"
                value={config.timeout_seconds.toString()}
                onChange={(value) => updateConfig({ timeout_seconds: parseInt(value) || 30 })}
                min="5"
                max="300"
              />
            </FormField>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700">Allow Function/Tool Calling</div>
              <Toggle
                checked={config.allowed_tools}
                onChange={(checked) => updateConfig({ allowed_tools: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700">Allow Web Access (if supported)</div>
              <Toggle
                checked={config.allowed_web_access}
                onChange={(checked) => updateConfig({ allowed_web_access: checked })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
