import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  name: string;
  members: string;
  college?: string;
  department?: string;
  score: number;
  roundsCompleted: number;
  change: string;
  status: 'active' | 'inactive' | 'warning';
}

export class LeaderboardEngine {
  static async getLeaderboard(eventId?: string): Promise<LeaderboardEntry[]> {
    // 1. If eventId not provided, get the first active or latest event
    let targetEventId = eventId;
    if (!targetEventId) {
      const { data: activeEvents } = await supabase
        .from('events')
        .select('id')
        .in('status', ['LIVE', 'REGISTRATION_OPEN', 'COMPLETED'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (activeEvents && activeEvents.length > 0) {
        targetEventId = activeEvents[0].id;
      }
    }

    // 2. Fetch teams for the event
    let query = supabase
      .from('teams')
      .select(`
        id,
        name,
        college,
        department,
        status,
        participants (name, college, department)
      `);
      
    if (targetEventId) {
      query = query.eq('event_id', targetEventId);
    }

    const { data: teams, error: teamsError } = await query;
      
    if (teamsError || !teams || teams.length === 0) return [];

    const teamIds = teams.map(t => t.id);

    // 3. Fetch round sessions for these teams
    const { data: sessions } = await supabase
      .from('round_sessions')
      .select('team_id, score, completed_at')
      .in('team_id', teamIds);

    // 4. Fetch score events adjustments if table exists
    const { data: scoreEvents } = await supabase
      .from('score_events')
      .select('team_id, points')
      .in('team_id', teamIds);

    // 5. Aggregate scores
    const teamStats = new Map<string, { score: number; completed: number }>();
    teams.forEach(t => teamStats.set(t.id, { score: 0, completed: 0 }));

    sessions?.forEach(session => {
      const current = teamStats.get(session.team_id);
      if (current) {
        current.score += (session.score || 0);
        if (session.completed_at) {
          current.completed += 1;
        }
      }
    });

    scoreEvents?.forEach(se => {
      const current = teamStats.get(se.team_id);
      if (current) {
        current.score += (se.points || 0);
      }
    });

    // 6. Build leaderboard entries
    const leaderboard: Omit<LeaderboardEntry, 'rank'>[] = teams.map(team => {
      const stats = teamStats.get(team.id) || { score: 0, completed: 0 };
      const participantList = (team.participants as any[]) || [];
      const members = participantList.length > 0
        ? participantList.map(p => p.name).join(', ')
        : 'Team Members';

      // Extract college & department from team or participant
      const college = team.college || participantList.find(p => p.college)?.college || '';
      const department = team.department || participantList.find(p => p.department)?.department || '';

      return {
        teamId: team.id,
        name: team.name,
        members,
        college,
        department,
        score: stats.score,
        roundsCompleted: stats.completed,
        change: '0',
        status: (team.status?.toLowerCase() === 'suspended' ? 'inactive' : 'active') as 'active' | 'inactive'
      };
    });

    leaderboard.sort((a, b) => b.score - a.score);

    // 7. Assign ranks
    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }
}
