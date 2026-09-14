import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Upload } from 'lucide-react';

export type ApexDomain = 'Healthcare' | 'Fintech' | 'Agriculture' | 'Education' | 'E-commerce' | 'Logistics';
const DETAILS: Record<ApexDomain, { fields: string[]; app: string }> = {
  Healthcare: { fields: ['Medical license number', 'Specialization', 'Years of experience'], app: 'Patient appointment booking: book, view and cancel appointments, with a doctor list.' },
  Fintech: { fields: ['PAN number', 'Risk-profile dropdown', 'KYC document upload'], app: 'Personal expense tracker: add, categorize and view expenses with a monthly total.' },
  Agriculture: { fields: ['Land holding size', 'Crop type (multi-select)', 'Irrigation source'], app: 'Crop listing marketplace: farmers list crops and buyers search listings.' },
  Education: { fields: ['Previous institution', 'Course/stream', 'Entrance exam score'], app: 'Course enrollment system: browse courses, enroll, and view enrolled courses.' },
  'E-commerce': { fields: ['GST number', 'Business category', 'Warehouse location'], app: 'Product catalog and cart: browse products, add items, and view the cart total.' },
  Logistics: { fields: ['Vehicle type', 'License class', 'Route zone preference'], app: 'Shipment tracker: create entries, update status, and view shipments.' },
};
interface Props { question: 1 | 2 | 3; domain: ApexDomain; configuration?: Record<string, unknown>; onSubmit: (payload: Record<string, unknown>) => Promise<void>; submitted: boolean; }
const inputClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

export function ApexChallenge({ question, domain, configuration, onSubmit, submitted }: Props) {
  const [html, setHtml] = useState(''); const [answers, setAnswers] = useState(['', '', '', '']);
  const [repoUrl, setRepoUrl] = useState(''); const [frontendUrl, setFrontendUrl] = useState(''); const [backendUrl, setBackendUrl] = useState(''); const [promptSheet, setPromptSheet] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dataset = (configuration?.datasets as Record<string, Record<string, string>> | undefined)?.[domain] || (configuration?.dataset as Record<string, string> | undefined);
  const q2GroundTruth = (configuration?.q2GroundTruth as Record<string, unknown> | undefined)?.[domain];
  const q2Configured = Array.isArray(q2GroundTruth) && q2GroundTruth.length === 4;
  const detail = DETAILS[domain];
  async function submit(payload: Record<string, unknown>) {
    setError(''); setBusy(true);
    try { await onSubmit(payload); } catch (err: any) { setError(err?.message || 'Submission could not be recorded. Please try again.'); } finally { setBusy(false); }
  }
  const buttonText = submitted ? 'Submitted' : busy ? 'Submitting...' : question === 1 ? 'Submit HTML file' : question === 2 ? 'Submit answers' : 'Submit deliverables';
  const prompts = ['Find the average value of ' + (dataset?.numericColumn || '[numeric column]') + '.', 'How many rows exceed that average?', 'Of those rows, what is the most common value in ' + (dataset?.categoryColumn || '[categorical column]') + '?', 'What percentage of the full dataset does that represent?'];
  return <main className="flex-1 overflow-y-auto bg-slate-50 p-6"><div className="mx-auto max-w-4xl space-y-5">
    <section className="rounded-xl border border-cyan-100 bg-cyan-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Assigned domain: {domain}</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Q{question}. {['Domain Registration Form', 'Large Dataset Drip Analysis', 'Full MERN Domain App'][question - 1]}</h2></section>
    {question === 1 && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-slate-800">Using <strong>Gemini only</strong>, generate a registration form for a <strong>{domain}</strong> customer onboarding page. Include proper UI styling and validation. Submit the single HTML file Gemini gives you.</p>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Only Gemini may be used. A coordinator may confirm the open tools and capture a submission screenshot.</p>
      <div><p className="mb-2 text-sm font-semibold text-slate-700">Contextual fields expected</p><ul className="grid gap-2 sm:grid-cols-3">{detail.fields.map(field => <li key={field} className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{field}</li>)}</ul></div>
      <label className="block text-sm font-semibold text-slate-700">Single HTML file<input disabled={submitted} type="file" accept=".html,text/html" className={inputClass} onChange={async e => { const file = e.target.files?.[0]; if (file) setHtml(await file.text()); }} /></label>
      {html && <p className="text-sm text-emerald-700">HTML file loaded ({html.length.toLocaleString()} characters).</p>}
      <button disabled={!html.trim() || busy || submitted} onClick={() => submit({ html })} className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{buttonText}</button>
    </section>}
    {question === 2 && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><strong>Dataset:</strong> {dataset?.name || domain} {dataset?.url && <a className="ml-2 inline-flex items-center gap-1 underline" href={dataset.url} target="_blank" rel="noreferrer">Open source <ExternalLink className="h-3 w-3" /></a>}</div>
      <p className="text-sm text-slate-600">Use Google Colab with Python and pandas. Answer independently; earlier answers are not used to grade later steps.</p>
      {!q2Configured && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">This dataset has not been configured by the event administrator yet. Answers cannot be submitted until its columns and four ground-truth values are set.</p>}
      {prompts.map((prompt, i) => <label key={prompt} className="block text-sm font-semibold text-slate-700">{i + 1}. {prompt}<input disabled={submitted} value={answers[i]} onChange={e => setAnswers(a => a.map((v, x) => x === i ? e.target.value : v))} className={inputClass} /></label>)}
      <button disabled={!q2Configured || answers.some(a => !a.trim()) || busy || submitted} onClick={() => submit({ answers })} className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{buttonText}</button>
    </section>}
    {question === 3 && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-slate-800">Build a <strong>{domain}</strong> MERN app: {detail.app}</p><p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">Required: public GitHub repo, Vercel frontend, Render/Railway backend, and a prompt sheet listing every AI prompt in order.</p>
      <label className="block text-sm font-semibold text-slate-700">Public GitHub repository URL<input disabled={submitted} type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-semibold text-slate-700">Live frontend URL (Vercel)<input disabled={submitted} type="url" value={frontendUrl} onChange={e => setFrontendUrl(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-semibold text-slate-700">Live backend URL (Render/Railway)<input disabled={submitted} type="url" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-semibold text-slate-700">Prompt sheet<textarea disabled={submitted} value={promptSheet} onChange={e => setPromptSheet(e.target.value)} rows={8} className={inputClass} placeholder={'Prompt 1: ...\n\nPrompt 2: ...'} /></label>
      <button disabled={!repoUrl || !frontendUrl || !backendUrl || !promptSheet.trim() || busy || submitted} onClick={() => submit({ repoUrl, frontendUrl, backendUrl, promptSheet })} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50"><Upload className="h-4 w-4" />{buttonText}</button>
    </section>}
    {submitted && <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5" />Submission recorded.</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div></main>;
}
