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
      // I'll add more types as needed during implementation...
    }
  }
}
