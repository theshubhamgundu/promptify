import { useEffect, useState } from 'react';
import { CertificateService } from '../lib/services/certificateService';
import type { CertificateRecord } from '../lib/types';
import { CheckCircleIcon, ShieldIcon, BrainIcon } from '../components/icons';

interface Props {
  certificateId: string;
  onGoHome?: () => void;
}

export default function PublicVerification({ certificateId, onGoHome }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    verified: boolean;
    certificate: CertificateRecord | null;
    statusMessage: string;
  }>({
    verified: false,
    certificate: null,
    statusMessage: 'Verifying...'
  });

  useEffect(() => {
    let mounted = true;
    async function doVerify() {
      setLoading(true);
      const res = await CertificateService.verifyCertificate(certificateId);
      if (mounted) {
        setResult(res);
        setLoading(false);
      }
    }
    doVerify();
    return () => { mounted = false; };
  }, [certificateId]);

  const cert = result.certificate;

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'TOP_10':
        return {
          label: 'Top 10 E-Certificate',
          bg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
          border: 'border-amber-400',
          icon: '🥇'
        };
      case 'TOP_20':
        return {
          label: 'Top 20 E-Certificate',
          bg: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
          border: 'border-blue-400',
          icon: '🥈'
        };
      case 'PARTICIPATION':
      default:
        return {
          label: 'Participation E-Certificate',
          bg: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
          border: 'border-emerald-400',
          icon: '📜'
        };
    }
  };

  const badge = getTypeBadge(cert?.certificate_type);

  // Parse members detail safely
  const membersList: { name: string; role?: string }[] = Array.isArray(cert?.members_detail)
    ? (cert?.members_detail as any)
    : [];

  return (
    <div className="min-h-screen bg-[#f9f7f4] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
          <BrainIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-[11px] font-black text-orange-500 uppercase tracking-widest font-heading">HAPPENO TECHNOLOGIES</div>
          <div className="text-base font-black text-gray-900 font-heading">Official Certificate Verification</div>
        </div>
      </div>

      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-scale-in">
        {loading ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-gray-600 font-semibold text-sm">Verifying Certificate Authenticity...</div>
            <div className="text-xs text-gray-400 font-mono">ID: {certificateId}</div>
          </div>
        ) : result.verified && cert ? (
          <div>
            {/* Verification Status Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-3 border border-white/40 shadow-inner">
                <CheckCircleIcon className="w-10 h-10 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider mb-1">
                <ShieldIcon className="w-3.5 h-3.5" /> VERIFIED / VALID
              </div>
              <h2 className="text-2xl font-black font-heading tracking-wide">CERTIFICATE VERIFIED</h2>
              <p className="text-green-100 text-xs mt-1">Authentic certificate issued by {cert.event_name}</p>
            </div>

            {/* Certificate Details */}
            <div className="p-6 space-y-5">
              {/* Type & Badge */}
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-heading font-bold mb-0.5">Certificate Type</div>
                  <div className="text-sm font-black text-gray-900 font-heading flex items-center gap-2">
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${badge.bg}`}>
                  {cert.certificate_type.replace('_', ' ')}
                </div>
              </div>

              {/* Team & Members */}
              <div className="space-y-3">
                <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest font-heading mb-1">Recipient Team</div>
                  <div className="text-xl font-black text-gray-900 font-heading">{cert.team_name}</div>
                  
                  {membersList.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-orange-100 space-y-1.5">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-heading">Team Members</div>
                      <div className="flex flex-wrap gap-1.5">
                        {membersList.map((m, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-white border border-orange-200 text-xs font-bold text-gray-800 rounded-lg px-2.5 py-1 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            {m.name} {m.role ? `(${m.role})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Score & Rank */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-heading mb-1">Final Rank</div>
                    <div className="text-3xl font-black text-orange-500 font-heading">#{cert.rank}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Leaderboard Standing</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-heading mb-1">Total Score</div>
                    <div className="text-3xl font-black text-gray-900 font-heading">{cert.total_score}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Points Earned</div>
                  </div>
                </div>
              </div>

              {/* Certificate Metadata */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-heading uppercase text-[10px] font-bold">Certificate ID</span>
                  <span className="font-mono font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5">{cert.certificate_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-heading uppercase text-[10px] font-bold">Event Name</span>
                  <span className="font-bold text-gray-800">{cert.event_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-heading uppercase text-[10px] font-bold">Issue Date</span>
                  <span className="text-gray-600">{new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-heading uppercase text-[10px] font-bold">Verification Source</span>
                  <span className="text-green-600 font-bold">✓ Official Database</span>
                </div>
              </div>

              {/* Footer action */}
              {onGoHome && (
                <button
                  onClick={onGoHome}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors text-sm shadow-md shadow-orange-200 font-heading"
                >
                  Return to Event Platform →
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Invalid / Not Found State */
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <span className="text-3xl">🚫</span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider mb-2">
                INVALID CERTIFICATE
              </div>
              <h2 className="text-xl font-black text-gray-900 font-heading">Certificate Not Found / Invalid</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                The certificate ID <span className="font-mono font-bold text-gray-800">{certificateId}</span> could not be verified in our official event database. It may be invalid, modified, or deleted.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 text-left space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-900">
                <span>⚠</span> Important Security Note:
              </div>
              <p>Only certificates generated and recorded by the official platform are authentic. Please verify the link or contact event coordinators if you believe this is an error.</p>
            </div>

            {onGoHome && (
              <button
                onClick={onGoHome}
                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-colors text-sm font-heading"
              >
                Go to Homepage
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} HAPPENO TECHNOLOGIES · Secure Cryptographic E-Certificate Verification
      </div>
    </div>
  );
}
