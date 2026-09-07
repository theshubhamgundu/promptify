import { supabase } from '../supabase';
import { LeaderboardEngine } from '../leaderboard-engine';
import { generateQRCodeDataURL } from '../qrGenerator';
import type { CertificateRecord } from '../types';

// In-memory local fallback store for offline/local dev
const localCertificates = new Map<string, CertificateRecord>();

export class CertificateService {
  /**
   * Determine certificate type based on final leaderboard rank.
   * Rank 1-5  -> null (Physical Certificate - No E-Certificate)
   * Rank 6-10 -> TOP_10
   * Rank 11-20 -> TOP_20
   * Rank 21+  -> PARTICIPATION
   */
  static determineCertificateType(rank: number, _totalTeams: number): 'TOP_10' | 'TOP_20' | 'PARTICIPATION' | null {
    if (rank <= 5) return null;
    if (rank <= 10) return 'TOP_10';
    if (rank <= 20) return 'TOP_20';
    return 'PARTICIPATION';
  }

  /**
   * Generate a unique certificate ID (e.g. CERT-TOP10-9X2K4L7M)
   */
  static generateUniqueCertificateId(type: 'TOP_10' | 'TOP_20' | 'PARTICIPATION'): string {
    const prefix = type === 'TOP_10' ? 'TOP10' : type === 'TOP_20' ? 'TOP20' : 'PART';
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `CERT-${prefix}-${rand}`;
  }

  /**
   * Get public base URL for verification links
   */
  static getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}`;
    }
    return 'http://localhost:8443';
  }

  /**
   * Batch generate or update certificates for eligible teams in an event based on final leaderboard ranks.
   */
  static async generateCertificatesForEvent(eventId: string): Promise<{ success: boolean; generated: number; excludedTop5: number; error?: string }> {
    try {
      // 1. Fetch Event name
      const { data: eventData } = await supabase
        .from('events')
        .select('name')
        .eq('id', eventId)
        .single();
      const eventName = eventData?.name || 'Prompt Championship 2026';

      // 2. Fetch Leaderboard
      const leaderboard = await LeaderboardEngine.getLeaderboard(eventId);
      if (!leaderboard || leaderboard.length === 0) {
        return { success: false, generated: 0, excludedTop5: 0, error: 'No teams found in leaderboard.' };
      }

      // 3. Fetch Team Participants
      const teamIds = leaderboard.map(l => l.teamId);
      const { data: participants } = await supabase
        .from('participants')
        .select('team_id, name, role')
        .in('team_id', teamIds);

      const partsMap = new Map<string, { name: string; role?: string }[]>();
      participants?.forEach(p => {
        const list = partsMap.get(p.team_id) || [];
        list.push({ name: p.name, role: p.role });
        partsMap.set(p.team_id, list);
      });

      // 4. Fetch existing certificates for this event
      const { data: existingCerts } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', eventId);

      const certMap = new Map<string, any>();
      existingCerts?.forEach(c => certMap.set(c.team_id, c));

      let generatedCount = 0;
      let excludedTop5Count = 0;
      const baseUrl = this.getBaseUrl();

      for (const entry of leaderboard) {
        const certType = this.determineCertificateType(entry.rank, leaderboard.length);

        // TOP 5 (Rank 1-5): Physical certificate only, exclude from E-Certificates
        if (!certType) {
          excludedTop5Count++;
          // If an e-certificate existed previously for this team (e.g. if rank changed), delete it
          if (certMap.has(entry.teamId)) {
            await supabase.from('certificates').delete().eq('team_id', entry.teamId).eq('event_id', eventId);
            certMap.delete(entry.teamId);
          }
          continue;
        }

        const teamMembers = partsMap.get(entry.teamId) || [
          { name: entry.members || 'Team Member' }
        ];

        const existing = certMap.get(entry.teamId);
        const certificateId = existing?.certificate_id || this.generateUniqueCertificateId(certType);
        const verificationUrl = `${baseUrl}?verify=${certificateId}`;
        const qrCodeDataUrl = generateQRCodeDataURL(verificationUrl);

        const recordPayload = {
          event_id: eventId,
          team_id: entry.teamId,
          certificate_id: certificateId,
          team_name: entry.name,
          event_name: eventName,
          members_detail: teamMembers,
          certificate_type: certType,
          rank: entry.rank,
          total_score: entry.score,
          status: 'VERIFIED' as const,
          verification_url: verificationUrl,
          qr_code_data_url: qrCodeDataUrl,
          issued_at: existing?.issued_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Update record if changed
          const { error: updateErr } = await supabase
            .from('certificates')
            .update(recordPayload)
            .eq('id', existing.id);

          if (!updateErr) generatedCount++;
        } else {
          // Insert new record
          const { error: insertErr } = await supabase
            .from('certificates')
            .insert(recordPayload);

          if (!insertErr) generatedCount++;
        }

        // Always store in local fallback store for seamless offline/dev operation
        localCertificates.set(certificateId, {
          id: existing?.id || certificateId,
          ...recordPayload,
          created_at: new Date().toISOString()
        });
      }

      return {
        success: true,
        generated: generatedCount,
        excludedTop5: excludedTop5Count
      };
    } catch (err: any) {
      console.error('Error generating certificates:', err);
      return { success: false, generated: 0, excludedTop5: 0, error: err.message };
    }
  }

  /**
   * Retrieve certificate information by certificate ID.
   */
  static async getCertificateById(certificateId: string): Promise<CertificateRecord | null> {
    if (!certificateId) return null;

    // 1. Try Supabase
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_id', certificateId.trim())
        .single();

      if (!error && data) {
        return data as CertificateRecord;
      }
    } catch (_e) {
      // Fall through to local fallback
    }

    // 2. Try local fallback store
    if (localCertificates.has(certificateId.trim())) {
      return localCertificates.get(certificateId.trim())!;
    }

    return null;
  }

  /**
   * Verify certificate status and return details.
   */
  static async verifyCertificate(certificateId: string): Promise<{
    verified: boolean;
    certificate: CertificateRecord | null;
    statusMessage: string;
  }> {
    const cert = await this.getCertificateById(certificateId);
    if (!cert) {
      return {
        verified: false,
        certificate: null,
        statusMessage: 'Certificate Not Found / Invalid Certificate'
      };
    }

    if (cert.status !== 'VERIFIED') {
      return {
        verified: false,
        certificate: cert,
        statusMessage: 'Certificate Has Been Revoked'
      };
    }

    return {
      verified: true,
      certificate: cert,
      statusMessage: 'Certificate Verified'
    };
  }

  /**
   * Fetch all certificates for an event.
   */
  static async getCertificatesByEvent(eventId: string): Promise<CertificateRecord[]> {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', eventId)
        .order('rank', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as CertificateRecord[];
      }
    } catch (_e) {}

    // Fallback to local memory items matching eventId
    return Array.from(localCertificates.values()).filter(c => c.event_id === eventId);
  }

  /**
   * Get certificate for a specific team.
   */
  static async getCertificateForTeam(eventId: string, teamId: string): Promise<CertificateRecord | null> {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', eventId)
        .eq('team_id', teamId)
        .single();

      if (!error && data) return data as CertificateRecord;
    } catch (_e) {}

    return Array.from(localCertificates.values()).find(c => c.event_id === eventId && c.team_id === teamId) || null;
  }

  /**
   * Revoke a certificate.
   */
  static async revokeCertificate(certificateId: string): Promise<boolean> {
    try {
      await supabase
        .from('certificates')
        .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
        .eq('certificate_id', certificateId);

      const local = localCertificates.get(certificateId);
      if (local) {
        local.status = 'REVOKED';
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
