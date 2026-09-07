/**
 * Audit Service
 * Handles admin action logging and audit trail management
 */

import { supabase } from './supabase';

export type AuditAction =
  | 'SCORE_OVERRIDE'
  | 'SCORE_ADJUSTMENT'
  | 'TEAM_FREEZE'
  | 'TEAM_UNFREEZE'
  | 'TIME_EXTENSION'
  | 'SESSION_RESET'
  | 'PARTICIPANT_VERIFICATION'
  | 'PARTICIPANT_REVOCATION'
  | 'EVENT_STATUS_CHANGE'
  | 'ROUND_STATUS_CHANGE'
  | 'CHALLENGE_MODIFICATION'
  | 'CHALLENGE_PUBLISH'
  | 'CHALLENGE_UNPUBLISH'
  | 'SNAPSHOT_CREATION'
  | 'SNAPSHOT_RESTORATION'
  | 'TEAM_DISQUALIFICATION'
  | 'SUBMISSION_REEVALUATION'
  | 'HINT_UNLOCK'
  | 'HINT_RESET'
  | 'ADMIN_ROLE_GRANT'
  | 'ADMIN_ROLE_REVOKE'
  | 'ROUND_START'
  | 'ROUND_END'
  | 'EVENT_PAUSE'
  | 'EVENT_RESUME'
  | 'MANUAL_SCORE_UPDATE';

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  event_id: string | null;
  timestamp: string;
  previous_value: any;
  new_value: any;
  reason: string | null;
  request_metadata: any;
  is_system_action: boolean;
}

export interface AuditLogReadable {
  id: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  event_id: string | null;
  event_name: string | null;
  timestamp: string;
  previous_value: any;
  new_value: any;
  reason: string | null;
  is_system_action: boolean;
}

export class AuditService {
  /**
   * Log an admin action
   */
  static async logAction(params: {
    adminId: string;
    action: AuditAction;
    targetType: string;
    targetId: string;
    eventId?: string;
    previousValue?: any;
    newValue?: any;
    reason?: string;
    requestMetadata?: any;
  }): Promise<{ success: boolean; auditId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('log_admin_action', {
        p_admin_id: params.adminId,
        p_action: params.action,
        p_target_type: params.targetType,
        p_target_id: params.targetId,
        p_event_id: params.eventId || null,
        p_previous_value: params.previousValue || null,
        p_new_value: params.newValue || null,
        p_reason: params.reason || null,
        p_request_metadata: params.requestMetadata || {},
      });

      if (error) throw error;

      return {
        success: true,
        auditId: data,
      };
    } catch (error: any) {
      console.error('Failed to log admin action:', error);
      return {
        success: false,
        error: error.message || 'Failed to log admin action',
      };
    }
  }

  /**
   * Get all audit logs with filters
   */
  static async getAuditLogs(filters?: {
    eventId?: string;
    adminId?: string;
    action?: AuditAction;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogReadable[]> {
    try {
      let query = supabase.from('audit_log_readable').select('*');

      if (filters?.eventId) {
        query = query.eq('event_id', filters.eventId);
      }

      if (filters?.adminId) {
        query = query.eq('admin_id', filters.adminId);
      }

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.targetType) {
        query = query.eq('target_type', filters.targetType);
      }

      if (filters?.targetId) {
        query = query.eq('target_id', filters.targetId);
      }

      query = query.order('timestamp', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a specific team (participant view)
   */
  static async getTeamAuditLogs(teamId: string): Promise<AuditLogReadable[]> {
    try {
      const { data, error } = await supabase
        .from('audit_log_readable')
        .select('*')
        .eq('target_type', 'team')
        .eq('target_id', teamId)
        .in('action', [
          'SCORE_OVERRIDE',
          'SCORE_ADJUSTMENT',
          'TIME_EXTENSION',
          'EVENT_STATUS_CHANGE',
          'ROUND_STATUS_CHANGE',
        ])
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to fetch team audit logs:', error);
      return [];
    }
  }

  /**
   * Export audit logs as CSV
   */
  static async exportAuditLogs(filters?: {
    eventId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<string> {
    try {
      const logs = await this.getAuditLogs({
        eventId: filters?.eventId,
        limit: 10000, // Max export
      });

      // Filter by date if provided
      let filteredLogs = logs;
      if (filters?.startDate || filters?.endDate) {
        filteredLogs = logs.filter((log) => {
          const logDate = new Date(log.timestamp);
          if (filters.startDate && logDate < new Date(filters.startDate)) return false;
          if (filters.endDate && logDate > new Date(filters.endDate)) return false;
          return true;
        });
      }

      // Convert to CSV
      const headers = [
        'Timestamp',
        'Admin',
        'Action',
        'Target Type',
        'Target ID',
        'Event',
        'Previous Value',
        'New Value',
        'Reason',
        'System Action',
      ];

      const rows = filteredLogs.map((log) => [
        log.timestamp,
        log.admin_name || log.admin_email,
        log.action,
        log.target_type,
        log.target_id,
        log.event_name || '',
        JSON.stringify(log.previous_value || {}),
        JSON.stringify(log.new_value || {}),
        log.reason || '',
        log.is_system_action ? 'Yes' : 'No',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      return csv;
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      return '';
    }
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(eventId?: string) {
    try {
      const logs = await this.getAuditLogs({
        eventId,
        limit: 10000,
      });

      const actionCounts: Record<string, number> = {};
      const adminCounts: Record<string, number> = {};

      logs.forEach((log) => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        adminCounts[log.admin_name] = (adminCounts[log.admin_name] || 0) + 1;
      });

      return {
        totalActions: logs.length,
        actionBreakdown: actionCounts,
        adminBreakdown: adminCounts,
        recentActions: logs.slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        totalActions: 0,
        actionBreakdown: {},
        adminBreakdown: {},
        recentActions: [],
      };
    }
  }

  /**
   * Format audit action for display
   */
  static formatAction(action: AuditAction): string {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get action color for UI
   */
  static getActionColor(action: AuditAction): string {
    const colorMap: Record<string, string> = {
      SCORE_OVERRIDE: 'text-orange-500',
      SCORE_ADJUSTMENT: 'text-orange-500',
      TEAM_FREEZE: 'text-red-500',
      TEAM_UNFREEZE: 'text-green-500',
      TIME_EXTENSION: 'text-blue-500',
      SESSION_RESET: 'text-yellow-500',
      PARTICIPANT_VERIFICATION: 'text-green-500',
      PARTICIPANT_REVOCATION: 'text-red-500',
      EVENT_STATUS_CHANGE: 'text-purple-500',
      ROUND_STATUS_CHANGE: 'text-purple-500',
      CHALLENGE_MODIFICATION: 'text-yellow-500',
      CHALLENGE_PUBLISH: 'text-green-500',
      CHALLENGE_UNPUBLISH: 'text-red-500',
      SNAPSHOT_CREATION: 'text-blue-500',
      SNAPSHOT_RESTORATION: 'text-orange-500',
      TEAM_DISQUALIFICATION: 'text-red-600',
      SUBMISSION_REEVALUATION: 'text-yellow-500',
    };

    return colorMap[action] || 'text-gray-500';
  }

  /**
   * Subscribe to real-time audit log updates
   */
  static subscribeToAuditLogs(
    eventId: string,
    callback: (log: AdminAuditLog) => void
  ): { unsubscribe: () => void } {
    const channel = supabase
      .channel('audit-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_audit_logs',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          callback(payload.new as AdminAuditLog);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  }
}
