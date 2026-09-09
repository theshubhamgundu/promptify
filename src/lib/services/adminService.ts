import { supabase } from '../supabase';

/**
 * Apply a penalty to a team by inserting a negative score event.
 * The points argument should be a positive number; the function will store it as negative.
 */
export async function applyPenalty(teamId: string, points: number, reason: string): Promise<void> {
  const penaltyPoints = -Math.abs(points);
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('score_events').insert({
    team_id: teamId,
    event_type: 'ADMIN_PENALTY',
    points: penaltyPoints,
    reason,
    admin_id: session?.user?.id,
  });
  if (error) {
    console.error('Failed to apply penalty:', error);
    throw error;
  }
  await supabase.from('activity_logs').insert({
    action: 'TEAM_PENALTY',
    team_id: teamId,
    details: { points: penaltyPoints, reason },
  });
}

/**
 * Toggle a team's status between ACTIVE and SUSPENDED.
 * The current status is passed in to decide the new status.
 */
export async function toggleTeamStatus(teamId: string, currentStatus: string | null | undefined): Promise<void> {
  const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('teams').update({ status: newStatus }).eq('id', teamId);
  if (error) {
    console.error('Failed to toggle team status:', error);
    throw error;
  }
  await supabase.from('activity_logs').insert({
    action: newStatus === 'SUSPENDED' ? 'TEAM_FROZEN' : 'TEAM_UNFROZEN',
    team_id: teamId,
    details: { admin_id: session?.user?.id },
  });
}
