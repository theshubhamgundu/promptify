// Example: Using BYOK in a Challenge Component
// This shows how to integrate BYOK into a challenge where participants need AI assistance

import { useState, useEffect } from 'react';
import { Button, FormField, TextArea, Badge } from '../components/ui';
import { BYOKConnect, BYOKConnected } from '../components/BYOKConnect';
import { 
  getBYOKConfig, 
  byokSession, 
  sendAIRequest, 
  getBYOKUsageStats,
  AIProvider,
  UsageStats 
} from '../lib/byok-service';
import { BrainIcon, ZapIcon } from '../components/icons';

interface Challenge {
  id: string;
  title: string;
  description: string;
  configuration: any;
}

interface BYOKChallengeExampleProps {
  challenge: Challenge;
  teamId: string;
  roundSessionId: string;
}

export default function BYOKChallengeExample({
  challenge,
  teamId,
  roundSessionId,
}: BYOKChallengeExampleProps) {
  const [showConnect, setShowConnect] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState<AIProvider | null>(null);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  const byokConfig = getBYOKConfig(challenge.configuration);

  // Load usage stats
  useEffect(() => {
    if (byokConfig) {
      loadUsageStats();
    }
  }, [challenge.id]);

  const loadUsageStats = async () => {
    if (!byokConfig) return;
    
    const stats = await getBYOKUsageStats(
      teamId,
      challenge.id,
      byokConfig.max_requests,
      byokConfig.max_total_tokens
    );
    setUsage(stats);
  };

  const handleConnect = (provider: AIProvider) => {
    setConnectedProvider(provider);
    setShowConnect(false);
  };

  const handleDisconnect = () => {
    if (connectedProvider) {
      byokSession.clearKey(connectedProvider);
      setConnectedProvider(null);
    }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim() || !connectedProvider || !byokConfig) return;

    setLoading(true);
    setResponse('');

    try {
      // Select a model from allowed models or use a default
      const model = byokConfig.allowed_models[0] || 
                    (connectedProvider === 'OPENAI' ? 'gpt-4' : 
                     connectedProvider === 'ANTHROPIC' ? 'claude-3-sonnet-20240229' : 
                     'gemini-1.5-pro');

      const result = await sendAIRequest(
        connectedProvider,
        teamId,
        roundSessionId,
        challenge.id,
        {
          messages: [
            { role: 'user', content: prompt }
          ],
          model: model,
          maxTokens: byokConfig.max_tokens_per_request,
        }
      );

      if (result.success && result.content) {
        setResponse(result.content);
        
        // Reload usage stats
        await loadUsageStats();
      } else {
        setResponse(`Error: ${result.error || 'Request failed'}`);
      }
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!byokConfig) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          This challenge does not require BYOK
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Challenge Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 font-heading mb-2">
          {challenge.title}
        </h1>
        <p className="text-gray-600">{challenge.description}</p>
      </div>

      {/* BYOK Status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-heading mb-1">
              AI Provider Connection
            </h3>
            <p className="text-xs text-gray-600">
              This challenge requires your own AI API key
            </p>
          </div>
          <BrainIcon className="w-8 h-8 text-orange-500" />
        </div>

        {connectedProvider ? (
          <BYOKConnected provider={connectedProvider} onDisconnect={handleDisconnect} />
        ) : (
          <Button onClick={() => setShowConnect(true)} fullWidth>
            Connect AI Provider
          </Button>
        )}

        {/* Usage Stats */}
        {usage && connectedProvider && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500 mb-1">Requests</div>
              <div className="text-lg font-bold text-gray-900">
                {usage.requestCount} / {byokConfig.max_requests}
              </div>
              <div className="text-xs text-gray-400">
                {usage.remainingRequests} remaining
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Tokens</div>
              <div className="text-lg font-bold text-gray-900">
                {usage.tokenCount.toLocaleString()} / {byokConfig.max_total_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">
                {usage.remainingTokens.toLocaleString()} remaining
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Interface */}
      {connectedProvider && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ZapIcon className="w-5 h-5 text-violet-500" />
            <h3 className="text-sm font-bold text-gray-900 font-heading">
              AI Assistant
            </h3>
            <Badge variant="ai">BYOK Active</Badge>
          </div>

          <FormField label="Your Prompt">
            <TextArea
              value={prompt}
              onChange={setPrompt}
              placeholder="Enter your prompt here..."
              rows={4}
              disabled={loading}
            />
          </FormField>

          <Button 
            onClick={handleSendPrompt}
            loading={loading}
            disabled={!prompt.trim() || loading || (usage?.remainingRequests || 0) <= 0}
            fullWidth
          >
            {loading ? 'Processing...' : 'Send to AI'}
          </Button>

          {response && (
            <div className="mt-4">
              <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                AI Response
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap border border-gray-200">
                {response}
              </div>
            </div>
          )}

          {usage && usage.remainingRequests <= 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              You've reached the maximum number of requests for this challenge.
            </div>
          )}
        </div>
      )}

      {/* Connect Modal */}
      {showConnect && (
        <BYOKConnect
          config={byokConfig}
          teamId={teamId}
          roundSessionId={roundSessionId}
          challengeId={challenge.id}
          onConnected={handleConnect}
          onCancel={() => setShowConnect(false)}
        />
      )}
    </div>
  );
}
