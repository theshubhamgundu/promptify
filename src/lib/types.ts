export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          is_frozen: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          name: string
          access_code: string
          is_frozen?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          name?: string
          access_code?: string
          is_frozen?: boolean
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          event_id: string
          name: string
          description: string | null
          type: string
          order_index: number
          duration_minutes: number
          scoring_config: any
          is_active: boolean
          status?: string
          created_at?: string
          challenges?: any[]
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          description?: string | null
          type: string
          order_index: number
          duration_minutes?: number
          scoring_config?: any
          is_active?: boolean
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          description?: string | null
          type?: string
          order_index?: number
          duration_minutes?: number
          scoring_config?: any
          is_active?: boolean
          status?: string
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          team_id: string
          name: string
          email: string
          role: string
          device_fingerprint?: string | null
          verified?: boolean
          is_verified?: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          email: string
          role: string
          device_fingerprint?: string | null
          verified?: boolean
          is_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          email?: string
          role?: string
          device_fingerprint?: string | null
          verified?: boolean
          is_verified?: boolean
          created_at?: string
        }
      }
      challenges: {
        Row: {
          id: string
          round_id: string
          order_index: number
          title: string
          description: string
          type: string
          base_points: number
          max_attempts: number | null
          configuration: any
          created_at?: string
        }
        Insert: {
          id?: string
          round_id: string
          order_index: number
          title: string
          description: string
          type: string
          base_points?: number
          max_attempts?: number | null
          configuration?: any
          created_at?: string
        }
        Update: {
          id?: string
          round_id?: string
          order_index?: number
          title?: string
          description?: string
          type?: string
          base_points?: number
          max_attempts?: number | null
          configuration?: any
          created_at?: string
        }
      }
      round_sessions: {
        Row: {
          id: string
          team_id: string
          round_id: string
          status: string
          start_time: string
          end_time: string | null
          completed_at: string | null
          score: number
          time_remaining_seconds: number | null
          duration_minutes: number
          is_locked: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          team_id: string
          round_id: string
          status?: string
          start_time?: string
          end_time?: string | null
          completed_at?: string | null
          score?: number
          time_remaining_seconds?: number | null
          duration_minutes?: number
          is_locked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          round_id?: string
          status?: string
          start_time?: string
          end_time?: string | null
          completed_at?: string | null
          score?: number
          time_remaining_seconds?: number | null
          duration_minutes?: number
          is_locked?: boolean
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          team_id: string
          challenge_id: string
          round_session_id?: string
          attempt_number: number
          payload: any
          score: number
          max_score: number
          passed: boolean
          feedback?: any
          is_final: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          team_id: string
          challenge_id: string
          round_session_id?: string
          attempt_number: number
          payload: any
          score?: number
          max_score?: number
          passed?: boolean
          feedback?: any
          is_final?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          challenge_id?: string
          round_session_id?: string
          attempt_number?: number
          payload?: any
          score?: number
          max_score?: number
          passed?: boolean
          feedback?: any
          is_final?: boolean
          created_at?: string
        }
      }
      [key: string]: any
    }
    Views: {
      [key: string]: any
    }
    Functions: {
      [key: string]: any
    }
  }
}
