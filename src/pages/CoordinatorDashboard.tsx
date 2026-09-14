import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';
import { CheckCircleIcon, ClockIcon, ShieldIcon } from '../components/icons';

type QueueItem = {
  id: string; team_id: string; team_name: string; team_code: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string; reviewed_at: string | null; rejection_reason: string | null;
  members: { name: string; email: string; rollNumber: string }[];
};

export default function CoordinatorDashboard() {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const { data: events, error: eventError } = await supabase.from('events').select('id, name').in('status', ['REGISTRATION_OPEN', 'LIVE']).order('created_at', { ascending: false }).limit(1);
    if (eventError || !events?.[0]) { setMessage('No active event is available for verification.'); setLoading(false); return; }
    setEvent(events[0]);
    const { data, error } = await supabase.rpc('get_coordinator_verification_queue', { p_event_id: events[0].id });
    if (error) setMessage(error.message); else setQueue((data || []) as QueueItem[]);
    setLoading(false);
  };
  const prepareScannedTeam = async (rawCode: string) => {
    const teamCode = rawCode.trim().replace(/^PROMPTIFY:TEAM:/i, '').toUpperCase();
    if (!teamCode || !event) return;
    setLoading(true);
    setMessage('Checking in scanned team…');
    const { error } = await supabase.rpc('prepare_scanned_team_verification', {
      p_event_id: event.id, p_team_code: teamCode
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    await load();
    setQuery(teamCode);
    setMessage('Team checked in. Verify IDs and choose Approve or Reject.');
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const channel = supabase.channel('coordinator-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const stopScanner = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    scanHandledRef.current = false;
    setScannerOpen(false);
  };
  const startScanner = async (deviceId?: string) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera requires HTTPS (or localhost) and browser camera permission. Enter the team code manually.');
      return;
    }
    try {
      stopScanner();
      scanHandledRef.current = false;
      setScannerOpen(true);
      setMessage('Starting camera…');
      await new Promise(resolve => window.setTimeout(resolve, 0));
      const reader = new BrowserQRCodeReader();
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      scannerControlsRef.current = await reader.decodeFromConstraints(constraints, videoRef.current || undefined, (result) => {
        if (!result || scanHandledRef.current) return;
        scanHandledRef.current = true;
        const scannedCode = result.getText().trim().replace(/^PROMPTIFY:TEAM:/i, '').toUpperCase();
        setQuery(scannedCode);
        void prepareScannedTeam(scannedCode);
        stopScanner();
      });
      const foundCameras = await BrowserQRCodeReader.listVideoInputDevices();
      setCameras(foundCameras);
      const activeId = scannerControlsRef.current.streamVideoSettingsGet?.(track => [track])?.deviceId;
      if (typeof activeId === 'string') setSelectedCamera(activeId);
      else if (deviceId) setSelectedCamera(deviceId);
      setMessage('Point the camera at the team QR code. Scanning is active.');
    } catch (error: any) {
      stopScanner();
      const message = error?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser address bar and retry.' : 'Could not start a camera. Check that another app is not using it, or enter the team code manually.';
      setMessage(message);
    }
  };
  useEffect(() => () => { scannerControlsRef.current?.stop(); }, []);

  const visible = useMemo(() => queue.filter(item => !query || `${item.team_name} ${item.team_code}`.toLowerCase().includes(query.toLowerCase())), [queue, query]);
  const scannedTeam = useMemo(() => {
    const code = query.trim().toUpperCase();
    return code ? queue.find(item => item.team_code.toUpperCase() === code) : undefined;
  }, [queue, query]);
  const decide = async (item: QueueItem, approved: boolean) => {
    const reason = approved ? null : window.prompt(`Reason for rejecting ${item.team_name}:`);
    if (!approved && !reason?.trim()) return;
    setActing(item.id); setMessage('');
    const { error } = await supabase.rpc('review_verification_request', { p_request_id: item.id, p_approved: approved, p_rejection_reason: reason });
    if (error) setMessage(error.message); else { setMessage(`${item.team_name} ${approved ? 'approved' : 'rejected'}.`); await load(); }
    setActing(null);
  };
  const signOut = async () => { await supabase.auth.signOut(); localStorage.clear(); window.location.hash = 'login'; window.location.reload(); };
  const pending = queue.filter(item => item.status === 'PENDING').length;

  return <div className="min-h-screen bg-[#f9f7f4] p-5 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Coordinator console</p><h1 className="mt-2 text-2xl font-bold">Entry verification</h1><p className="mt-1 text-sm text-slate-300">{event?.name || 'Loading event…'} · {pending} team{pending === 1 ? '' : 's'} waiting</p></div>
        <div className="flex gap-3"><Button onClick={load} variant="outline" className="border-slate-600 text-slate-900">Refresh</Button><Button onClick={signOut} className="bg-rose-500 hover:bg-rose-600">Sign out</Button></div>
      </header>
      <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"><span><ShieldIcon className="mr-2 inline h-4 w-4" />Scan a team QR code or enter its code manually, then approve only after checking IDs.</span><Button onClick={scannerOpen ? stopScanner : () => void startScanner()} className="bg-slate-900 hover:bg-slate-800">{scannerOpen ? 'Close camera' : 'Open camera scanner'}</Button></section>
      {scannerOpen && <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black p-3"><video ref={videoRef} autoPlay playsInline muted className="mx-auto max-h-96 w-full max-w-2xl rounded-xl object-contain" />{cameras.length > 1 && <div className="mx-auto mt-3 flex max-w-2xl items-center gap-3"><label className="text-xs font-bold text-white">Camera</label><select value={selectedCamera} onChange={event => void startScanner(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"><option value="">Rear / default camera</option>{cameras.map(camera => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${camera.deviceId.slice(-4)}`}</option>)}</select></div>}</div>}
      <input autoFocus value={query} onChange={e => setQuery(e.target.value.toUpperCase())} placeholder="Scan or enter team code / team name" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
      {query && !loading && !scannedTeam && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-amber-900">No verification request found for “{query}”.</p><p className="mt-1 text-sm text-amber-800">Ask the team to sign in and open its verification screen first. Then press Refresh and scan again.</p><Button onClick={load} className="mt-3 bg-amber-600 hover:bg-amber-700">Refresh verification queue</Button></div>}
      {scannedTeam && <section className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Scanned team — verify IDs before approval</p><h2 className="mt-1 text-xl font-bold text-gray-900">{scannedTeam.team_name}</h2><p className="mt-1 font-mono text-sm font-bold text-emerald-700">{scannedTeam.team_code}</p><div className="mt-3 space-y-1">{scannedTeam.members.map(member => <p key={member.email} className="text-sm text-gray-700"><span className="font-semibold">{member.name}</span> · {member.rollNumber}</p>)}</div></div>{scannedTeam.status === 'PENDING' ? <div className="flex min-w-56 gap-3"><Button disabled={acting === scannedTeam.id} onClick={() => decide(scannedTeam, true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircleIcon className="mr-1 h-4 w-4" />Approve team</Button><Button disabled={acting === scannedTeam.id} onClick={() => decide(scannedTeam, false)} className="flex-1 bg-rose-600 hover:bg-rose-700">Reject</Button></div> : <span className="rounded-full bg-white px-3 py-2 text-sm font-bold text-gray-700">{scannedTeam.status}</span>}</div></section>}
      {message && <p className="rounded-xl bg-white p-4 text-sm font-medium text-gray-700">{message}</p>}
      {loading ? <p className="py-12 text-center text-gray-500">Loading verification queue…</p> : <div className="grid gap-4 md:grid-cols-2">
        {visible.map(item => <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-orange-600">{item.team_code}</p><h2 className="mt-1 text-lg font-bold text-gray-900">{item.team_name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><ClockIcon className="h-3.5 w-3.5" /> {new Date(item.created_at).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{item.status}</span></div>
          <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3">{item.members.map(member => <div key={member.email}><p className="text-sm font-semibold text-gray-800">{member.name}</p><p className="text-xs text-gray-500">{member.rollNumber} · {member.email}</p></div>)}</div>
          {item.status === 'PENDING' ? <div className="mt-4 flex gap-3"><Button disabled={acting === item.id} onClick={() => decide(item, true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircleIcon className="mr-1 h-4 w-4" />Approve</Button><Button disabled={acting === item.id} onClick={() => decide(item, false)} className="flex-1 bg-rose-600 hover:bg-rose-700">Reject</Button></div> : item.rejection_reason ? <p className="mt-3 text-xs text-rose-700">Reason: {item.rejection_reason}</p> : null}
        </article>)}
      </div>}
    </div>
  </div>;
}
