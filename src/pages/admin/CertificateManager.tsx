import { useState, useEffect } from 'react';
import { CertificateService } from '../../lib/services/certificateService';
import type { CertificateRecord } from '../../lib/types';
import { useAdminStore } from '../../stores/adminStore';
import { Button, Modal } from '../../components/ui';
import { TrophyIcon, CheckCircleIcon, ShieldIcon, CopyIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

export default function CertificateManager({ navigate }: { navigate?: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal for QR code preview
  const [activeCertModal, setActiveCertModal] = useState<CertificateRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCertificates = async () => {
    if (!activeEvent) return;
    setLoading(true);
    const list = await CertificateService.getCertificatesByEvent(activeEvent.id);
    setCertificates(list);
    setLoading(false);
  };

  useEffect(() => {
    loadCertificates();
  }, [activeEvent]);

  const handleGenerate = async () => {
    if (!activeEvent) return;
    setGenerating(true);
    setResultMsg(null);

    const res = await CertificateService.generateCertificatesForEvent(activeEvent.id);
    setGenerating(false);

    if (res.success) {
      setResultMsg({
        type: 'success',
        text: `Successfully processed certificates: ${res.generated} E-Certificates generated/updated. ${res.excludedTop5} Top 5 teams assigned Physical Certificates.`
      });
      await loadCertificates();
    } else {
      setResultMsg({
        type: 'error',
        text: res.error || 'Failed to generate certificates.'
      });
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (certId: string) => {
    if (confirm(`Are you sure you want to revoke certificate ${certId}?`)) {
      await CertificateService.revokeCertificate(certId);
      await loadCertificates();
    }
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  // Counts
  const top10Count = certificates.filter(c => c.certificate_type === 'TOP_10').length;
  const top20Count = certificates.filter(c => c.certificate_type === 'TOP_20').length;
  const partCount = certificates.filter(c => c.certificate_type === 'PARTICIPATION').length;

  return (
    <div className="p-8 space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-orange-600 uppercase tracking-widest font-heading mb-1">
            <TrophyIcon className="w-4 h-4 text-orange-500" />
            AUTOMATED E-CERTIFICATE ENGINE
          </div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">E-Certificate Management</h1>
          <p className="text-gray-500 text-sm mt-1">Generate rank-based E-Certificates and QR verification links for {activeEvent.name}</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="shadow-lg shadow-orange-500/20 py-3 px-6 text-sm font-heading"
        >
          {generating ? 'Processing Ranks & Issuing...' : '⚡ Issue / Update Certificates'}
        </Button>
      </div>

      {resultMsg && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 ${
          resultMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{resultMsg.type === 'success' ? '✅' : '❌'}</span>
          <span>{resultMsg.text}</span>
        </div>
      )}

      {/* Rules & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md">
          <div className="text-[10px] font-black text-white/80 uppercase tracking-widest font-heading">TOP 1–5 TEAMS</div>
          <div className="text-2xl font-black font-heading mt-1">Physical Certs</div>
          <div className="text-xs text-amber-100 mt-1 font-medium">Excluded from E-Certificates</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest font-heading">RANKS 6–10 (TOP 10)</div>
          <div className="text-3xl font-black text-gray-900 font-heading mt-1">{top10Count}</div>
          <div className="text-xs text-gray-400 mt-1">Top 10 E-Certificates Issued</div>
        </div>

        <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest font-heading">RANKS 11–20 (TOP 20)</div>
          <div className="text-3xl font-black text-gray-900 font-heading mt-1">{top20Count}</div>
          <div className="text-xs text-gray-400 mt-1">Top 20 E-Certificates Issued</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs">
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest font-heading">RANKS 21+</div>
          <div className="text-3xl font-black text-gray-900 font-heading mt-1">{partCount}</div>
          <div className="text-xs text-gray-400 mt-1">Participation E-Certificates</div>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-orange-900">
        <span className="text-base">ℹ️</span>
        <div>
          <span className="font-bold">Automated Rank Assignment Rules:</span>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-orange-800">
            <li><strong>Top 5:</strong> Physical Certificates handed out at ceremony. E-certificates strictly omitted.</li>
            <li><strong>Rank 6–10:</strong> Receives <em>Top 10 E-Certificate</em>.</li>
            <li><strong>Rank 11–20:</strong> Receives <em>Top 20 E-Certificate</em>.</li>
            <li><strong>Rank 21+:</strong> Receives <em>Participation E-Certificate</em>.</li>
          </ul>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 font-heading text-sm">Issued Certificates ({certificates.length})</h2>
          <span className="text-xs text-gray-400 font-mono">Sorted by Final Rank</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading certificate records...</div>
        ) : certificates.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
              <TrophyIcon className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-gray-900">No Certificates Generated Yet</div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Click "Issue / Update Certificates" above to process final leaderboard ranks and generate unique verification QR codes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 font-heading border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Rank</th>
                  <th className="px-6 py-3">Team Name</th>
                  <th className="px-6 py-3">Certificate Type</th>
                  <th className="px-6 py-3">Certificate ID</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-black font-heading text-gray-900">
                      #{cert.rank}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {cert.team_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black font-heading ${
                        cert.certificate_type === 'TOP_10'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : cert.certificate_type === 'TOP_20'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {cert.certificate_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">
                      {cert.certificate_id}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {cert.total_score} pts
                    </td>
                    <td className="px-6 py-4">
                      {cert.status === 'VERIFIED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                          REVOKED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setActiveCertModal(cert)}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-bold transition-colors"
                      >
                        View QR
                      </button>
                      <button
                        onClick={() => handleCopyLink(cert.verification_url, cert.certificate_id)}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <CopyIcon className="w-3 h-3" />
                        {copiedId === cert.certificate_id ? 'Copied!' : 'Copy Link'}
                      </button>
                      {cert.status === 'VERIFIED' && (
                        <button
                          onClick={() => handleRevoke(cert.certificate_id)}
                          className="px-2 py-1 text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Preview Modal */}
      {activeCertModal && (
        <Modal
          title={`Certificate QR Code - ${activeCertModal.team_name}`}
          onClose={() => setActiveCertModal(null)}
          size="sm"
          footer={
            <Button onClick={() => setActiveCertModal(null)} className="w-full">
              Close Preview
            </Button>
          }
        >
          <div className="space-y-4 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center">
              {activeCertModal.qr_code_data_url ? (
                <img
                  src={activeCertModal.qr_code_data_url}
                  alt="Certificate QR Code"
                  className="w-48 h-48 rounded-xl shadow-md bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-500">
                  No QR Generated
                </div>
              )}
              <div className="mt-4 text-xs font-mono font-bold text-orange-600">
                {activeCertModal.certificate_id}
              </div>
            </div>

            <div className="text-left text-xs space-y-1 bg-gray-50 p-3 rounded-xl">
              <div><span className="font-bold text-gray-600">Rank:</span> #{activeCertModal.rank}</div>
              <div><span className="font-bold text-gray-600">Type:</span> {activeCertModal.certificate_type}</div>
              <div><span className="font-bold text-gray-600">URL:</span> <a href={activeCertModal.verification_url} target="_blank" rel="noreferrer" className="text-orange-600 underline font-mono break-all">{activeCertModal.verification_url}</a></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
