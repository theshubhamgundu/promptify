/**
 * Snapshot Manager
 * Admin interface for creating and restoring event snapshots
 */

import { useState, useEffect } from 'react';
import { SnapshotService, type SnapshotSummary } from '../../lib/snapshot-service';
import { AuditService } from '../../lib/audit-service';
import { useAuthStore } from '../../stores/authStore';
import { Button, Card, Modal } from '../../components/ui';
import { supabase } from '../../lib/supabase';

interface Props {
  navigate: (page: string) => void;
}

export default function SnapshotManager({ navigate }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [createDescription, setCreateDescription] = useState('');
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadSnapshots();
    }
  }, [selectedEvent]);

  async function loadEvents() {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) setEvents(data);
  }

  async function loadSnapshots() {
    setLoading(true);
    const data = await SnapshotService.getEventSnapshots(selectedEvent);
    setSnapshots(data);
    setLoading(false);
  }

  async function handleCreateSnapshot() {
    if (!user?.id || !selectedEvent) return;

    setLoading(true);
    const result = await SnapshotService.createSnapshot(
      selectedEvent,
      user.id,
      'MANUAL',
      createDescription
    );

    if (result.success) {
      // Log audit action
      await AuditService.logAction({
        adminId: user.id,
        action: 'SNAPSHOT_CREATION',
        targetType: 'event',
        targetId: selectedEvent,
        eventId: selectedEvent,
        newValue: { snapshot_id: result.snapshotId, description: createDescription },
        reason: 'Manual snapshot creation',
      });

      setShowCreateModal(false);
      setCreateDescription('');
      loadSnapshots();
    } else {
      alert(`Failed to create snapshot: ${result.error}`);
    }

    setLoading(false);
  }

  async function handleRestoreSnapshot() {
    if (!user?.id || !selectedEvent || !selectedSnapshot || !restoreConfirm) return;

    if (!restoreReason.trim()) {
      alert('Please provide a reason for restoration');
      return;
    }

    setLoading(true);
    const result = await SnapshotService.restoreFromSnapshot(
      selectedSnapshot.id,
      selectedEvent,
      user.id,
      restoreReason
    );

    if (result.success) {
      // Log audit action
      await AuditService.logAction({
        adminId: user.id,
        action: 'SNAPSHOT_RESTORATION',
        targetType: 'event',
        targetId: selectedEvent,
        eventId: selectedEvent,
        newValue: { snapshot_id: selectedSnapshot.id, restoration_id: result.restorationId },
        reason: restoreReason,
      });

      setShowRestoreModal(false);
      setRestoreReason('');
      setRestoreConfirm(false);
      setSelectedSnapshot(null);
      loadSnapshots();
      alert('Event restored successfully! All participants should refresh their sessions.');
    } else {
      alert(`Failed to restore snapshot: ${result.error}`);
    }

    setLoading(false);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-500';
      case 'CREATING':
        return 'text-yellow-500';
      case 'FAILED':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Snapshot Manager</h1>
          <p className="text-gray-400 mt-1">Create and restore event snapshots for recovery</p>
        </div>
        <button
          onClick={() => navigate('admin')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Event Selector */}
      <Card className="p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Select Event</label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">-- Select an Event --</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} ({event.status})
            </option>
          ))}
        </select>
      </Card>

      {selectedEvent && (
        <>
          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={() => setShowCreateModal(true)} disabled={loading}>
              📸 Create Snapshot
            </Button>
            <Button onClick={loadSnapshots} variant="secondary" disabled={loading}>
              🔄 Refresh
            </Button>
          </div>

          {/* Snapshots List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Event Snapshots</h2>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading snapshots...</div>
            ) : snapshots.length === 0 ? (
              <Card className="p-8 text-center text-gray-400">
                No snapshots found for this event. Create one to enable recovery.
              </Card>
            ) : (
              snapshots.map((snapshot) => (
                <Card key={snapshot.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-white">
                          {snapshot.snapshot_type === 'MANUAL' && '📸 Manual Snapshot'}
                          {snapshot.snapshot_type === 'AUTO_PRE_RESTORE' && '🔄 Pre-Restore Backup'}
                          {snapshot.snapshot_type === 'SCHEDULED' && '⏰ Scheduled Snapshot'}
                        </span>
                        <span className={`text-sm font-medium ${getStatusColor(snapshot.status)}`}>
                          {snapshot.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-500">Teams</div>
                          <div className="text-lg font-bold text-white">{snapshot.team_count}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Participants</div>
                          <div className="text-lg font-bold text-white">{snapshot.participant_count}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Submissions</div>
                          <div className="text-lg font-bold text-white">{snapshot.submission_count}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Created</div>
                          <div className="text-sm text-white">{formatDate(snapshot.created_at)}</div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-400">
                        <strong>Created by:</strong> {snapshot.created_by_name}
                      </div>

                      {snapshot.description && (
                        <div className="text-sm text-gray-400 mt-1">
                          <strong>Description:</strong> {snapshot.description}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {snapshot.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setSelectedSnapshot(snapshot);
                            setShowRestoreModal(true);
                          }}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Create Event Snapshot">
          <div className="space-y-4">
            <p className="text-gray-300">
              This will create a complete immutable snapshot of the event state including teams,
              participants, rounds, challenges, submissions, and scores.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                rows={3}
                placeholder="e.g., Pre-Round 3 backup, End of Day 1, etc."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                {loading ? 'Creating...' : 'Create Snapshot'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Restore Snapshot Modal */}
      {showRestoreModal && selectedSnapshot && (
        <Modal onClose={() => setShowRestoreModal(false)} title="⚠️ Restore Event Snapshot">
          <div className="space-y-4">
            <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 font-medium mb-2">⚠️ WARNING: Destructive Operation</p>
              <p className="text-sm text-gray-300">
                Restoring this snapshot will <strong>REPLACE</strong> all current event data with the
                snapshot state. This includes teams, participants, submissions, and scores.
              </p>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg space-y-2">
              <h3 className="font-medium text-white">Snapshot Details:</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <div>
                  <strong>Created:</strong> {formatDate(selectedSnapshot.created_at)}
                </div>
                <div>
                  <strong>Teams:</strong> {selectedSnapshot.team_count}
                </div>
                <div>
                  <strong>Participants:</strong> {selectedSnapshot.participant_count}
                </div>
                <div>
                  <strong>Submissions:</strong> {selectedSnapshot.submission_count}
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
              <p className="text-blue-400 text-sm">
                ✓ A pre-restore backup will be created automatically before restoration begins.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason for Restoration <span className="text-red-500">*</span>
              </label>
              <textarea
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                rows={3}
                placeholder="Explain why you are restoring this snapshot..."
                required
              />
            </div>

            <label className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                I understand this will replace current event data and all participants must refresh
                their sessions after restoration.
              </span>
            </label>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreSnapshot}
                disabled={loading || !restoreConfirm || !restoreReason.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Restoring...' : 'Restore Snapshot'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

