// AI Test Chat Component
// Simple chat interface to test BYOK connection

import { useState } from 'react';
import { Card, Button } from './ui';
import { SendIcon } from './icons';
import { AIProvider, byokSession } from '../lib/byok-service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AITestChatProps {
  provider: AIProvider;
}

export function AITestChat({ provider }: AITestChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const apiKey = byokSession.getKey(provider);
      if (!apiKey) {
        throw new Error('No API key found');
      }

      // Direct API call based on provider
      let response;
      if (provider === 'OPENAI') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (provider === 'ANTHROPIC') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.content[0]?.text || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (provider === 'GROQ') {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.6-27b',
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (provider === 'GOOGLE') {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: 150 },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (provider === 'MISTRAL') {
        response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral-tiny',
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (provider === 'COHERE') {
        response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'API request failed');
        }

        const data = await response.json();
        const assistantMessage = data.text || 'No response';
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else {
        throw new Error(`Provider ${provider} not supported in test chat yet`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Request failed';
      setError(errorMsg);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error: ${errorMsg}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          🧪 Test {provider} Connection
        </div>
        <button
          onClick={() => setMessages([])}
          className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            Try asking: "Hello, how are you?"
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`text-xs p-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-indigo-50 text-indigo-900 ml-8'
                  : 'bg-gray-50 text-gray-900 mr-8'
              }`}
            >
              <div className="font-semibold mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
                {msg.role === 'user' ? '👤 You' : '🤖 AI'}
              </div>
              <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="bg-gray-50 text-gray-500 mr-8 p-2 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-100" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-200" />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2 text-[10px] text-gray-500 text-center">
        💡 This uses your actual API key - costs will apply
      </div>
    </Card>
  );
}
