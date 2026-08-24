import { useState, useEffect } from 'react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { TargetIcon, ClockIcon, CheckIcon, LockIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

interface Round {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  type: string;
  order_index: number;
  duration_minutes: number | null;
  scoring_config: any;
  is_active: boolean;
}

export default function RoundManager({ navigate }: { navigate: (p: Page) => void }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('rounds').select('*').order('order_index');
      if (data) setRounds(data);
      setLoading(false);
    }
    load();
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('rounds').update({ is_active: !current }).eq('id', id);
    if (!error) {
      setRounds(rounds.map(r => r.id === id ? { ...r, is_active: !current } : r));
    }
  };

  const roundIcons: Record<string, string> = {
    QUIZ: '🧠',
    PROMPT: '🎯',
    ESCAPE_ROOM: '🧩',
    BATTLE: '⚔️',
    GRANDMASTER: '👑',
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Round Manager</h1>
          <p className="text-gray-500 text-sm">Configure rounds, challenges, and timing</p>
        </div>
        <Button>+ Add Round</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading rounds...</div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm text-gray-500 font-semibold">No rounds configured</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round, i) => (
            <div
              key={round.id}
              className={`rounded-2xl border overflow-hidden transition-all duration-300 hover:scale-[1.005] shadow-sm ${
                round.is_active 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="p-5 flex items-center gap-5">
                {/* Order badge */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl ${
                  round.is_active ? 'bg-green-100' : 'bg-gray-50 border border-gray-100'
                }`}>
                  {roundIcons[round.type] || '📋'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-heading ${
                      round.is_active ? 'bg-green-500 text-white shadow-sm shadow-green-200' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {round.order_index}
                    </span>
                    <h3 className="text-base font-black text-gray-900 font-heading">{round.name}</h3>
                    <span className={`text-[10px] font-black font-heading px-2 py-0.5 rounded-full ${
                      round.is_active 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {round.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  {round.description && (
                    <p className="text-xs text-gray-500 mt-1 max-w-xl">{round.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 font-heading uppercase tracking-wider">Type</div>
                    <div className="text-xs font-bold text-gray-700 mt-0.5">{round.type}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 font-heading uppercase tracking-wider">Duration</div>
                    <div className="text-xs font-bold text-orange-600 mt-0.5">{round.duration_minutes || '—'} min</div>
                  </div>
                  <button
                    onClick={() => toggleActive(round.id, round.is_active)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${
                      round.is_active
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    {round.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
