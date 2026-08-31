/**
 * Snapshot Service
 * Handles event snapshot creation, restoration, and management
 */

import { supabase } from './supabase';

export type SnapshotType = 'MANUAL' | 'AUTO_PRE_RESTORE' | 'SCHEDULED' | 'PRE_CRITICAL_CHANGE';
export type SnapshotStatus = 'CREATING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

export interface EventSnapshot {
  id: string;
  event_id: string;
  snapshot_type: SnapshotType;
  status: SnapshotStatus;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  description: string | null;
  data_checksum: string | null;
  snapshot_size_bytes: number | null;
  metadata: {
    team_count?: number;
    participant_count?: number;
    submission_count?: number;
    snapshot_version?: string;
  };
  is_archived: boolean;
}

export interface SnapshotSummary {
  id: string;
  event_id: string;
  event_name: string;
  snapshot_type: SnapshotType;
  status: SnapshotStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;
  completed_at: string | null;
  description: string | null;
  metadata: any;
  team_count: number;
  participant_count: number;
  submission_count: number;
}

export interface SnapshotRestoration {
  id: string;
  snapshot_id: string;
  event_id: string;
  restored_by: string;
  restored_at: string;
  reason: string;
  pre_restore_snapshot_id: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  error_message: string | null;
  affected_teams: number | null;
  affected_submissions: number | null;
  metadata: any;
}

export class SnapshotService {
  /**
   * Create a new event snapshot
   */
  static async createSnapshot(
    eventId: string,
    createdBy: string,
    snapshotType: SnapshotType = 'MANUAL',
    description?: string
  ): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_event_snapshot', {
        p_event_id: eventId,
        p_created_by: createdBy,
        p_snapshot_type: snapshotType,
        p_description: description || null,
      });

      if (error) throw error;

      return {
        success: true,
        snapshotId: data,
      };
    } catch (error: any) {
      console.error('Failed to create snapshot:', error);
      return {
        success: false,
        error: error.message || 'Failed to create snapshot',
      };
    }
  }

  /**
   * Get all snapshots for an event
   */
  static async getEventSnapshots(eventId: string): Promise<SnapshotSummary[]> {
    try {
      const { data, error } = await supabase
        .from('snapshot_summary')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
      return [];
    }
  }

  /**
   * Get a specific snapshot by ID
   */
  static async getSnapshot(snapshotId: string): Promise<EventSnapshot | null> {
    try {
      const { data, error } = await supabase
        .from('event_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
      return null;
    }
  }

  /**
   * Restore event from snapshot
   */
  static async restoreFromSnapshot(
    snapshotId: string,
    eventId: string,
    restoredBy: string,
    reason: string
  ): Promise<{ success: boolean; restorationId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('restore_event_from_snapshot', {
        p_snapshot_id: snapshotId,
        p_event_id: eventId,
        p_restored_by: restoredBy,
        p_reason: reason,
      });

      if (error) throw error;

      return {
        success: true,
        restorationId: data,
      };
    } catch (error: any) {
      console.error('Failed to restore snapshot:', error);
      return {
        success: false,
        error: error.message || 'Failed to restore snapshot',
      };
    }
  }

  /**
   * Get restoration history for an event
   */
  static async getRestorationHistory(eventId: string): Promise<SnapshotRestoration[]> {
    try {
      const { data, error } = await supabase
        .from('recent_restorations')
        .select('*')
        .eq('event_id', eventId)
        .order('restored_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to fetch restoration history:', error);
      return [];
    }
  }

  /**
   * Archive a snapshot (soft delete)
   */
  static async archiveSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('event_snapshots')
        .update({ is_archived: true })
        .eq('id', snapshotId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Failed to archive snapshot:', error);
      return {
        success: false,
        error: error.message || 'Failed to archive snapshot',
      };
    }
  }

  /**
   * Compare two snapshots to show differences
   */
  static compareSnapshots(
    snapshot1: SnapshotSummary,
    snapshot2: SnapshotSummary
  ): {
    teamsDiff: number;
    participantsDiff: number;
    submissionsDiff: number;
  } {
    return {
      teamsDiff: snapshot2.team_count - snapshot1.team_count,
      participantsDiff: snapshot2.participant_count - snapshot1.participant_count,
      submissionsDiff: snapshot2.submission_count - snapshot1.submission_count,
    };
  }

  /**
   * Validate snapshot integrity
   */
  static async validateSnapshot(snapshotId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Fetch snapshot metadata
      const snapshot = await this.getSnapshot(snapshotId);

      if (!snapshot) {
        return { valid: false, error: 'Snapshot not found' };
      }

      if (snapshot.status !== 'COMPLETED') {
        return { valid: false, error: `Snapshot status is ${snapshot.status}` };
      }

      // Could add checksum validation here if needed

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get snapshot statistics for display
   */
  static getSnapshotStats(snapshot: SnapshotSummary) {
    return {
      teams: snapshot.team_count || 0,
      participants: snapshot.participant_count || 0,
      submissions: snapshot.submission_count || 0,
      created: new Date(snapshot.created_at).toLocaleString(),
      createdBy: snapshot.created_by_name,
      type: snapshot.snapshot_type,
      status: snapshot.status,
    };
  }
}
