import { useState, useEffect } from 'react';
import { TrophyIcon, RefreshIcon } from '../components/icons';
import { Badge, Card } from '../components/ui';
import { LeaderboardEngine, LeaderboardEntry } from '../lib/leaderboard-engine';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { supabase } from '../lib/supabase';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const currentEvent = useEventStore(s => s.currentEvent);
  const currentTeam = useTeamStore(s => s.currentTeam);

  const fetchLeaderboard = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const data = await LeaderboardEngine.getLeaderboard(currentEvent.id);
      setLeaderboard(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Error fetching leaderboard', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    if (!currentEvent) return;
    
    // Subscribe to realtime round session score changes to update leaderboard
    const channel = supabase.channel('leaderboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_sessions' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEvent]);

  const myTeamData = leaderboard.find(t => t.teamId === currentTeam?.id);
  const myRank = myTeamData?.rank ?? '—';
  const myScore = myTeamData?.score ?? 0;
  
  // Tag our team for rendering
  const displayBoard = leaderboard.map(t => ({
    ...t,
    isOurs: t.teamId === currentTeam?.id
  }));

  return (
    <div className="p-6">
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Teams', value: leaderboard.length.toString(), sub: 'registered' },
          { label: 'Active Teams', value: leaderboard.filter(t => t.status === 'active').length.toString(), sub: 'competing now' },
          { label: 'Your Rank', value: myRank.toString(), sub: myRank === '—' ? 'not yet ranked' : 'current position' },
          { label: 'Your Score', value: myScore.toString(), sub: myScore === 0 ? 'complete a round first' : 'total points' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{s.label}</div>
            <div className="text-2xl font-bold text-gray-900 font-heading">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Top 3 podium */}
      <Card className="p-6 mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
        <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-5 font-heading text-center">Top 3 Teams</div>
        <div className="flex items-end justify-center gap-4">
          {/* 2nd */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 border-4 border-gray-300 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-gray-600 font-bold text-lg font-heading">B</span>
            </div>
            <div className="text-xs font-bold text-gray-700 font-heading">ByteBusters</div>
            <div className="text-lg font-bold text-gray-900 font-heading">841</div>
            <div className="w-20 h-16 bg-gray-200 rounded-t-xl flex items-center justify-center mx-auto mt-2">
              <span className="text-2xl font-bold text-gray-500 font-heading">2</span>
            </div>
          </div>
          {/* 1st */}
          <div className="text-center">
            <div className="text-2xl mb-1">👑</div>
            <div className="w-20 h-20 bg-orange-100 border-4 border-orange-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-orange-600 font-bold text-xl font-heading">N</span>
            </div>
            <div className="text-sm font-bold text-gray-900 font-heading">Team Nexus</div>
            <div className="text-2xl font-bold text-orange-600 font-heading">876</div>
            <div className="w-20 h-24 bg-orange-400 rounded-t-xl flex items-center justify-center mx-auto mt-2">
              <span className="text-2xl font-bold text-white font-heading">1</span>
            </div>
          </div>
          {/* 3rd */}
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-50 border-4 border-amber-200 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-amber-600 font-bold text-lg font-heading">P</span>
            </div>
            <div className="text-xs font-bold text-gray-700 font-heading">PromptPros</div>
            <div className="text-lg font-bold text-gray-900 font-heading">798</div>
            <div className="w-20 h-12 bg-amber-200 rounded-t-xl flex items-center justify-center mx-auto mt-2">
              <span className="text-2xl font-bold text-amber-700 font-heading">3</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Full leaderboard table */}
      <Card>
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="text-sm font-bold text-gray-900 font-heading">Full Rankings</div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Updated: {lastUpdated}</span>
            <button className="text-gray-400 hover:text-orange-500 transition-colors">
              <RefreshIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                {['Rank', 'Team', 'Members', 'Score', 'Rounds', 'Change', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide font-heading">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayBoard.map((team) => (
                <tr
                  key={team.rank}
                  className={`border-t border-gray-50 transition-colors ${team.isOurs ? 'bg-orange-50 border-orange-100' : 'hover:bg-gray-50/50'}`}
                >
                  <td className="px-4 py-3.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-heading ${
                      team.rank === 1 ? 'bg-orange-500 text-white' :
                      team.rank === 2 ? 'bg-gray-200 text-gray-700' :
                      team.rank === 3 ? 'bg-amber-200 text-amber-700' :
                      team.isOurs ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {team.rank}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{team.name}</span>
                      {team.isOurs && <Badge variant="orange">You</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500">{team.members}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-lg font-bold font-heading ${team.isOurs ? 'text-orange-500' : 'text-gray-900'}`}>
                      {team.score}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < team.roundsCompleted ? 'bg-orange-400' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-bold font-heading ${
                      team.change.startsWith('+') ? 'text-green-600' :
                      team.change.startsWith('-') ? 'text-red-500' :
                      'text-gray-400'
                    }`}>
                      {team.change}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      team.status === 'active' ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${team.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400 text-center">
          Rankings update automatically when scores change. Sensitive information is not disclosed.
        </div>
      </Card>
    </div>
  );
}
