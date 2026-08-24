import { useState, useEffect } from 'react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { UsersIcon, CopyIcon, CheckIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

interface Team {
  id: string;
  name: string;
  access_code: string;
  event_id: string | null;
  created_at: string;
}

export default function TeamManager({ navigate }: { navigate: (p: Page) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
      if (data) setTeams(data);
      setLoading(false);
    }
    load();
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const teamColors = [
    'from-orange-500 to-red-500',
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-amber-400 to-orange-500',
    'from-pink-500 to-rose-500',
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Team Manager</h1>
          <p className="text-gray-500 text-sm">View registered teams and manage access codes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 font-medium">
            {teams.length} team{teams.length !== 1 ? 's' : ''} registered
          </div>
          <Button>+ Add Team</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-sm text-gray-500 font-semibold">No teams registered yet</div>
          <div className="text-xs text-gray-400 mt-1">Teams will appear here once they register.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {teams.map((team, i) => (
            <div
              key={team.id}
              className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:border-gray-200 hover:shadow-md transition-all group"
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${teamColors[i % teamColors.length]} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
                    <span className="text-white text-lg font-black font-heading">{team.name.charAt(0)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-gray-900 font-heading truncate">{team.name}</h3>
                      <div className="flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-700 font-bold uppercase tracking-wide">Active</span>
                      </div>
                    </div>

                    {/* Access Code */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 font-mono text-sm text-orange-600 font-bold tracking-wider">
                        {team.access_code}
                      </div>
                      <button
                        onClick={() => copyCode(team.access_code, team.id)}
                        className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-orange-50 hover:border-orange-200 transition-all text-gray-500 hover:text-orange-600"
                      >
                        {copiedId === team.id
                          ? <CheckIcon className="w-4 h-4 text-green-500" />
                          : <CopyIcon className="w-4 h-4" />
                        }
                      </button>
                    </div>

                    {/* Meta */}
                    <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-400 font-medium">
                      <span>Joined: {new Date(team.created_at).toLocaleDateString()}</span>
                      <span>ID: {team.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
