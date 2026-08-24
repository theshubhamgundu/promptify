import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  name: string;
  members: string;
  score: number;
  roundsCompleted: number;
  change: string;
  status: 'active' | 'inactive' | 'warning';
}

export class LeaderboardEngine {
  static async getLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    // 1. Fetch teams for the event
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        participants (name)
      `)
      .eq('event_id', eventId);
      
    if (teamsError || !teams) return [];

    // 2. Fetch round sessions for these teams
    const teamIds = teams.map(t => t.id);
    const { data: sessions, error: sessionsError } = await supabase
      .from('round_sessions')
      .select('team_id, score, completed_at')
      .in('team_id', teamIds);
      
    if (sessionsError) return [];

    // 3. Aggregate scores
    const teamScores = new Map<string, { score: number; completed: number }>();
    teams.forEach(t => teamScores.set(t.id, { score: 0, completed: 0 }));

    sessions?.forEach(session => {
      const current = teamScores.get(session.team_id);
      if (current) {
        current.score += session.score;
        if (session.completed_at) {
          current.completed += 1;
        }
      }
    });

    // 4. Build leaderboard and sort
    const leaderboard: Omit<LeaderboardEntry, 'rank'>[] = teams.map(team => {
      const stats = teamScores.get(team.id) || { score: 0, completed: 0 };
      const members = team.participants ? team.participants.map(p => p.name).join(', ') : 'No members';
      return {
        teamId: team.id,
        name: team.name,
        members,
        score: stats.score,
        roundsCompleted: stats.completed,
        change: '0', // We don't have historical data without snapshots, default to 0
        status: 'active'
      };
    });

    leaderboard.sort((a, b) => b.score - a.score);

    // 5. Assign ranks
    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }
}
