import { useState, useEffect } from 'react';
import { Badge, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ZapIcon, ClockIcon, CheckCircleIcon, AlertTriangleIcon } from '../../components/icons';
import type { Database } from '../../lib/types';
import type { Page } from '../../components/Layout';

type Event = Database['public']['Tables']['events']['Row'];

const statusConfig: Record<string, { color: string; dot: string; label: string }> = {
  DRAFT:             { color: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Draft' },
  REGISTRATION_OPEN: { color: 'text-blue-600',   dot: 'bg-blue-500',   label: 'Registration Open' },
  LIVE:              { color: 'text-green-600',  dot: 'bg-green-500',  label: 'Live' },
  PAUSED:            { color: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Paused' },
  COMPLETED:         { color: 'text-violet-600', dot: 'bg-violet-500', label: 'Completed' },
};

const statusFlow = ['DRAFT', 'REGISTRATION_OPEN', 'LIVE', 'PAUSED', 'COMPLETED'];

export default function EventManager({ navigate }: { navigate: (p: Page) => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
      setLoading(false);
    }
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('events').update({ status: status as any }).eq('id', id);
    if (!error) {
      setEvents(events.map(e => e.id === id ? { ...e, status: status as any } : e));
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Event Manager</h1>
          <p className="text-gray-500 text-sm">Create and control championship lifecycle</p>
        </div>
        <Button className="gap-2">
          <ZapIcon className="w-4 h-4" />
          Create New Event
        </Button>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm text-gray-500 font-semibold">No events yet</div>
          <div className="text-xs text-gray-400 mt-1">Create your first championship event to get started.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const sc = statusConfig[event.status] || statusConfig.DRAFT;
            return (
              <div key={event.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl flex items-center justify-center border border-orange-100">
                        <ZapIcon className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 font-heading">{event.name}</h3>
                        <p className="text-sm text-gray-500 max-w-lg">{event.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                      <span className={`w-2.5 h-2.5 rounded-full ${sc.dot} ${event.status === 'LIVE' ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-black font-heading ${sc.color}`}>{sc.label}</span>
                    </div>
                  </div>

                  {/* Event meta */}
                  <div className="flex items-center gap-6 mb-5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>Start: {event.start_time ? new Date(event.start_time).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>End: {event.end_time ? new Date(event.end_time).toLocaleString() : '—'}</span>
                    </div>
                  </div>

                  {/* Status flow */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 rounded-xl border border-gray-100">
                    {statusFlow.map((s) => {
                      const isActive = event.status === s;
                      const conf = statusConfig[s];
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(event.id, s)}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold font-heading transition-all duration-200 ${
                            isActive
                              ? `bg-white shadow-sm border border-gray-200 ${conf.color}`
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                          }`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
