import { supabase } from '../supabase';

export class TeamService {
  /**
   * Resolves the full context for a logged-in user.
   * User -> Participant -> Team -> Event
   */
  static async getContextForUser(userId: string) {
    // 1. Find participant record for this user
    const { data: participant, error: partError } = await supabase
      .from('participants')
      .select('team_id, name, role')
      .eq('user_id', userId)
      .single();

    if (partError || !participant) {
      console.error('Participant not found for user', partError);
      return null;
    }

    // 2. Find team and event
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, access_code, event_id')
      .eq('id', participant.team_id)
      .single();

    if (teamError || !team) {
      console.error('Team not found for participant', teamError);
      return null;
    }

    // 3. Find event
    let event = null;
    if (team.event_id) {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', team.event_id)
        .single();
      event = eventData;
    }

    // 4. Fetch all members of the team
    const { data: members } = await supabase
      .from('participants')
      .select('*')
      .eq('team_id', team.id);

    // 5. Fetch team session
    const { data: session } = await supabase
      .from('team_sessions')
      .select('*')
      .eq('team_id', team.id)
      .maybeSingle();

    return {
      participant,
      team,
      event,
      members: members || [],
      session: session || null,
    };
  }

  static async getTeamSession(teamId: string) {
    const { data, error } = await supabase
      .from('team_sessions')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();
    
    if (!data) {
      // Not found, create one
      const { data: newSession } = await supabase
        .from('team_sessions')
        .insert({ team_id: teamId, state: 'CREATED' })
        .select()
        .maybeSingle();
      return newSession;
    }
    return data;
  }
}
