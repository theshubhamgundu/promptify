import React, { useEffect, useState } from 'react';
import type { Page } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { ChallengeHeader } from '../components/round5/ChallengeHeader';
import { ApexChallenge, type ApexDomain } from '../components/round5/ApexChallenge';

interface Round5EngineProps { roundId: string; navigate: (p: Page) => void; }
const DOMAINS: ApexDomain[] = ['Healthcare', 'Fintech', 'Agriculture', 'Education', 'E-commerce', 'Logistics'];

export default function Round5Engine({ roundId, navigate }: Round5EngineProps) {
  const team = useTeamStore(s => s.currentTeam);
  const [round, setRound] = useState<any>(); const [session, setSession] = useState<any>();
  const [challengeSession, setChallengeSession] = useState<any>();
  const [challenges, setChallenges] = useState<any[]>([]); const [index, setIndex] = useState(0);
  const [domain, setDomain] = useState<ApexDomain>('Healthcare'); const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { async function load() {
    if (!team) return; setLoading(true);
    const [{ data: roundData }, { data: challengeData }] = await Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('challenges').select('*').eq('round_id', roundId).order('order_index'),
    ]);
    setRound(roundData); setChallenges(challengeData || []);
    const { data: teamWithDomain, error: domainError } = await supabase.from('teams').select('domain').eq('id', team.id).single();
    if (domainError || !teamWithDomain?.domain) console.error('Unable to load the team domain:', domainError);
    setDomain((teamWithDomain?.domain as ApexDomain) || DOMAINS[0]);
    const { data: existingSessions } = await supabase.from('round_sessions').select('*').eq('team_id', team.id).eq('round_id', roundId).limit(1);
    let roundSession = existingSessions?.[0] || null;
    if (!roundSession) { const { data } = await supabase.from('round_sessions').upsert({ team_id: team.id, round_id: roundId, started_at: new Date().toISOString(), status: 'IN_PROGRESS' }, { onConflict: 'team_id,round_id', ignoreDuplicates: false }).select().single(); roundSession = data; }
    setSession(roundSession); setLoading(false);
  } load(); }, [team, roundId]);

  useEffect(() => { async function restore() {
    const challenge = challenges[index]; if (!session || !challenge || !team) return;
    const { data } = await supabase.from('submissions').select('id').eq('team_id', team.id).eq('challenge_id', challenge.id).eq('round_session_id', session.id).order('created_at', { ascending: false }).limit(1);
    setSubmitted(Boolean(data?.[0]));
  } restore(); }, [index, challenges, session, team]);

  useEffect(() => { async function startTimer() {
    const challenge = challenges[index];
    if (!session || !challenge || !team) return;
    setChallengeSession(undefined);
    const minutes = Number(challenge.configuration?.durationMinutes || [10, 10, 20][index]);
    const { data, error } = await supabase.rpc('start_apex_challenge_session', {
      p_team_id: team.id,
      p_round_session_id: session.id,
      p_challenge_id: challenge.id,
      p_duration_minutes: minutes,
    });
    if (error) { console.error('Unable to start Apex timer:', error); return; }
    setChallengeSession((data as any)?.session);
  } startTimer(); }, [index, challenges, session, team]);

  async function submit(payload: Record<string, unknown>) {
    const { error } = await supabase.rpc('submit_apex_answer', { p_team_id: team!.id, p_round_session_id: session.id, p_challenge_id: challenges[index].id, p_payload: payload });
    if (error) throw error; setSubmitted(true);
  }
  async function next() {
    if (index < challenges.length - 1) { setIndex(i => i + 1); return; }
    await supabase.from('round_sessions').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', session.id); navigate('dashboard');
  }
  const handleExit = async () => {
    if (!team || !roundId) return;
    try {
      await supabase.rpc('abandon_round_session', { p_team_id: team.id, p_round_id: roundId });
    } catch (e) {
      console.error('Failed to abandon session', e);
    }
    navigate('dashboard');
  };
  if (loading || !session || !round) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Preparing Apex challenge…</div>;
  if (!challenges.length) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Round 5 has not been configured yet.</div>;
  const challenge = challenges[index]; const minutes = Number(challenge.configuration?.durationMinutes || [10, 10, 20][index]);
  return <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
    <ChallengeHeader challengeName={challenge.title} challengeIndex={index} totalChallenges={challenges.length} deadlineAt={challengeSession?.deadline_at || null} totalSeconds={minutes * 60} score={session.score || 0} />
    <ApexChallenge question={(index + 1) as 1 | 2 | 3} domain={domain} configuration={challenge.configuration} submitted={submitted} onSubmit={submit} />
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3"><span className="text-sm text-slate-500">Question {index + 1} of {challenges.length}</span><div className="flex items-center gap-3"><button onClick={handleExit} className="rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Exit</button><button disabled={!submitted} onClick={next} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{index === challenges.length - 1 ? 'Finish round' : 'Continue'}</button></div></footer>
  </div>;
}
