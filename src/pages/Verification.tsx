import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { BrainIcon, CheckCircleIcon, ShieldIcon } from '../components/icons';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';

type VerifState = 'pending' | 'approved';

export default function Verification({ onApprove }: { onApprove: () => void }) {
  const [state, setState] = useState<VerifState>('pending');
  const [dots, setDots] = useState('');
  
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);
  const setSessionState = useTeamStore(s => s.setSessionState);

  const teamName = currentTeam?.name || 'Your Team';
  const teamCode = currentTeam?.access_code || '------';
  const [qrMarkup, setQrMarkup] = useState('');

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    QRCode.toString(`PROMPTIFY:TEAM:${teamCode}`, {
      type: 'svg', errorCorrectionLevel: 'M', margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' }
    }).then(svg => { if (active) setQrMarkup(svg); });
    return () => { active = false; };
  }, [teamCode]);

  // Poll for real coordinator approval in team_sessions
  useEffect(() => {
    if (!currentTeam) return;

    let mounted = true;
    
    // Check initial state
    const checkState = async () => {
      const { data } = await supabase
        .from('team_sessions')
        .select('state')
        .eq('team_id', currentTeam.id)
        .maybeSingle();
        
      if (data && data.state === 'VERIFIED' && mounted) {
        setState('approved');
        setSessionState('VERIFIED');
      }
    };
    
    checkState();
    void supabase.rpc('request_team_verification', {
      p_device_info: { userAgent: navigator.userAgent, requestedAt: new Date().toISOString() }
    });

    // Subscribe to changes
    const channel = supabase.channel('session_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_sessions', filter: `team_id=eq.${currentTeam.id}` },
        (payload) => {
          if (payload.new.state === 'VERIFIED') {
            setState('approved');
            setSessionState('VERIFIED');
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentTeam, setSessionState]);

  if (state === 'approved') {
    return (
      <div className="min-h-screen bg-[#f9f7f4] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircleIcon className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">Verification Complete</h2>
          <p className="text-green-600 font-semibold mb-1">✓ Team Verified</p>
          <p className="text-green-600 font-semibold mb-5">✓ Competition Access Granted</p>
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-6 text-sm text-green-700">
            Your team has been approved by the coordinator. You may now access all competition features.
          </div>
          <Button onClick={onApprove} className="w-full py-3">
            Enter Competition →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f7f4] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <BrainIcon />
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">HAPPENO TECHNOLOGIES</div>
            <div className="text-base font-bold text-gray-900 font-heading">Coordinator Verification</div>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-full px-4 py-1.5 text-amber-700 text-sm font-semibold mb-4">
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Waiting for coordinator approval{dots}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 font-heading">WAITING FOR COORDINATOR VERIFICATION</h2>
          <p className="text-gray-500 text-sm mt-2">Competition remains locked until approved.</p>
        </div>

        {/* Team info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Team</div>
            <div className="font-bold text-gray-900 font-heading">{teamName}</div>
            <div className="mt-2 space-y-1">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {m.name}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Device</div>
              <div className="text-sm font-semibold text-green-600">✓ Verified</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Coordinator</div>
              <div className="text-sm font-semibold text-amber-600">⏳ Pending</div>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 bg-gray-50 rounded-xl p-5">
          <div className="w-36 h-36 bg-white border-2 border-gray-200 rounded-xl p-2 flex items-center justify-center" aria-label={`QR code for ${teamCode}`} dangerouslySetInnerHTML={{ __html: qrMarkup }} />
          <p className="text-sm text-gray-500 text-center font-medium">Scan this code with the coordinator device</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldIcon className="w-3.5 h-3.5" />
            Team Code: <span className="font-mono font-bold text-orange-500">{teamCode}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <span className="text-amber-500">⚠</span>
          <p className="text-sm text-amber-700">Do not close this window. Competition access will be granted automatically upon approval.</p>
        </div>
      </div>
    </div>
  );
}
