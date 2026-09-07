export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface CertificateRecord {
  id: string
  certificate_id: string
  event_id: string
  team_id: string
  team_name: string
  event_name: string
  members_detail: { name: string; role?: string; email?: string }[] | Json
  certificate_type: 'TOP_10' | 'TOP_20' | 'PARTICIPATION'
  rank: number
  total_score: number
  status: 'VERIFIED' | 'REVOKED'
  verification_url: string
  qr_code_data_url?: string | null
  issued_at: string
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          name: string
          description: string | null
          status: 'DRAFT' | 'REGISTRATION_OPEN' | 'LIVE' | 'PAUSED' | 'COMPLETED'
          start_time: string | null
          end_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: 'DRAFT' | 'REGISTRATION_OPEN' | 'LIVE' | 'PAUSED' | 'COMPLETED'
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: 'DRAFT' | 'REGISTRATION_OPEN' | 'LIVE' | 'PAUSED' | 'COMPLETED'
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          event_id: string | null
          name: string
          access_code: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          name: string
          access_code: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          name?: string
          access_code?: string
          created_at?: string
        }
      }
      certificates: {
        Row: CertificateRecord
        Insert: Omit<CertificateRecord, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<CertificateRecord>
      }
    }
  }
}
