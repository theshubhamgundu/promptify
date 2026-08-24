import { Card, Badge, Button, SectionHeader } from '../components/ui';
import { UsersIcon, ShieldIcon, CheckCircleIcon } from '../components/icons';
import { useTeamStore } from '../stores/teamStore';

export default function Team() {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);

  const teamName = currentTeam?.name || 'Your Team';
  const teamCode = currentTeam?.access_code || '------';
  const membersCount = members?.length || 0;
  const teamInitials = teamName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-3xl">
      {/* Team header */}
      <Card className="p-6 mb-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-sm shadow-orange-200">
            <span className="text-white text-2xl font-bold font-heading">{teamInitials}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-heading">{teamName}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">Code: <strong className="font-mono text-orange-500">{teamCode}</strong></span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500">{membersCount} Members</span>
            </div>
          </div>
          <div className="ml-auto flex flex-col gap-1">
            <div className="text-[11px] text-green-600 font-medium flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Device Verified
            </div>
            <div className="text-[11px] text-green-600 font-medium flex items-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Session Active
            </div>
            <div className="text-[11px] text-green-600 font-medium flex items-center gap-1">
              <ShieldIcon className="w-3.5 h-3.5" /> Secure Session
            </div>
          </div>
        </div>
      </Card>

      {/* Members */}
      <Card className="p-5 mb-5">
        <SectionHeader icon={<UsersIcon className="w-4 h-4" />} title="Team Members" />
        <div className="space-y-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className={`w-12 h-12 ${m.role === 'CAPTAIN' ? 'bg-orange-500' : 'bg-violet-500'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-base font-bold font-heading">{m.name[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-gray-900">{m.name}</span>
                  <Badge variant={m.role === 'CAPTAIN' ? 'orange' : 'info'}>{m.role}</Badge>
                </div>
                <div className="text-xs text-gray-500 truncate">Shared Team Device</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security status */}
      <Card className="p-5 bg-green-50 border-green-100">
        <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3 font-heading">Session Security</div>
        <div className="grid grid-cols-3 gap-3">
          {[['✓ Device Verified', 'Team device cleared'], ['✓ Team Session', 'Active and secured'], ['✓ Secure Channel', 'Encrypted connection']].map(([label, sub]) => (
            <div key={label} className="text-center">
              <div className="text-green-700 font-semibold text-sm">{label}</div>
              <div className="text-xs text-green-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
