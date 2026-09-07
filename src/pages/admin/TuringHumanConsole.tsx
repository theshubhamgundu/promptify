import { useState, useEffect } from 'react';
import { Button, TextArea } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../lib/sound';
import { UsersIcon, SendIcon, RefreshIcon, CheckCircleIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

interface TuringConsoleProps {
  navigate: (p: Page) => void;
}

export default function TuringHumanConsole({ navigate }: TuringConsoleProps) {
  const [pendingInteractions, setPendingInteractions] = useState<any[]>([]);
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState<Record<string, boolean>>({});

  const loadPending = async () => {
    const { data, error } = await supabase
      .from('turing_test_interactions')
      .select('*, teams(name)')
      .eq('responder_type', 'HUMAN')
      .is('response', null)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setPendingInteractions(data);
    }
  };

  useEffect(() => {
    loadPending();

    // Subscribe to new questions
    const sub = supabase
      .channel('admin-turing-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'turing_test_interactions' }, () => {
        loadPending();
      })
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const handleSendResponse = async (interactionId: string) => {
    const text = responseTexts[interactionId]?.trim();
    if (!text) return;

    setIsSending(prev => ({ ...prev, [interactionId]: true }));
    sounds.click();

    try {
      const { error } = await supabase
        .from('turing_test_interactions')
        .update({
          response: text,
          responded_at: new Date().toISOString()
        })
        .eq('id', interactionId);

      if (error) throw error;

      sounds.success();
      setResponseTexts(prev => {
        const next = { ...prev };
        delete next[interactionId];
        return next;
      });

      loadPending();
    } catch (err) {
      console.error('Failed to dispatch human reply:', err);
      sounds.error();
    } finally {
      setIsSending(prev => ({ ...prev, [interactionId]: false }));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
            HUMAN RESPONDER CONSOLE
          </div>
          <h1 className="text-2xl font-black font-heading text-white">
            Turing Test: Live Interrogation Queue
          </h1>
        </div>
        <Button onClick={loadPending} variant="outline" className="text-xs py-2 flex items-center gap-1.5">
          <RefreshIcon className="w-3.5 h-3.5" /> Refresh Queue
        </Button>
      </div>

      <div className="p-4 bg-purple-950/30 border border-purple-800/50 rounded-2xl text-xs text-purple-200 font-mono leading-relaxed">
        <strong>INSTRUCTIONS:</strong> You are responding to teams who are currently interrogating you in Round 4.3. Type authentic human answers naturally and promptly.
      </div>

      {/* Questions Queue */}
      <div className="space-y-4">
        {pendingInteractions.length === 0 ? (
          <div className="p-12 bg-gray-900 border border-gray-800 rounded-3xl text-center space-y-3 font-mono text-gray-500">
            <UsersIcon className="w-12 h-12 mx-auto opacity-30 text-purple-400" />
            <div className="text-sm font-bold text-gray-400">Queue is Clear</div>
            <div className="text-xs">No pending interrogation questions awaiting human response.</div>
          </div>
        ) : (
          pendingInteractions.map(item => (
            <div key={item.id} className="p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="font-bold text-orange-400 text-sm">
                  {item.teams?.name || 'Unknown Team'} (Q#{item.sequence_number})
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(item.created_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="p-4 bg-black/60 rounded-xl border border-gray-800 text-gray-200 text-sm">
                <span className="text-gray-500 font-bold block text-xs mb-1">INCOMING QUESTION:</span>
                "{item.question}"
              </div>

              <div className="space-y-2">
                <TextArea
                  rows={3}
                  value={responseTexts[item.id] || ''}
                  onChange={e => setResponseTexts(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Type your response as Subject Zero..."
                  className="bg-black/80 border-gray-700 text-xs text-purple-300 font-mono resize-none"
                  disabled={isSending[item.id]}
                />

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSendResponse(item.id)}
                    disabled={!responseTexts[item.id]?.trim() || isSending[item.id]}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-lg flex items-center gap-1.5"
                  >
                    {isSending[item.id] ? 'Sending...' : 'Dispatch Reply'}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
