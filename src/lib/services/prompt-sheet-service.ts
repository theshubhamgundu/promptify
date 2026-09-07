import { supabase } from '../supabase';
import { PromptSheetEntry } from './ai-workspace-service';

export class PromptSheetService {
  /**
   * Fetch paginated prompt sheet entries for a specific challenge session
   */
  static async getEntries(challengeSessionId: string, page = 1, limit = 20): Promise<{ entries: PromptSheetEntry[]; count: number; error?: string }> {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, count, error } = await supabase
        .from('prompt_sheet_entries')
        .select('*', { count: 'exact' })
        .eq('challenge_session_id', challengeSessionId)
        .order('sequence_number', { ascending: false }) // Newest first
        .range(from, to);

      if (error) throw error;

      return {
        entries: data as PromptSheetEntry[],
        count: count || 0
      };
    } catch (error: any) {
      console.error('Failed to get prompt sheet entries:', error);
      return { entries: [], count: 0, error: error.message };
    }
  }

  /**
   * Fetch all prompt sheet entries for a round session (used for analytics/export)
   */
  static async getEntriesForRound(roundSessionId: string): Promise<{ entries: PromptSheetEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('prompt_sheet_entries')
        .select('*')
        .eq('round_session_id', roundSessionId)
        .order('created_at', { ascending: true }); // Chronological

      if (error) throw error;

      return { entries: data as PromptSheetEntry[] };
    } catch (error: any) {
      console.error('Failed to get round prompt sheet entries:', error);
      return { entries: [], error: error.message };
    }
  }

  /**
   * Get a specific entry by ID with full details
   */
  static async getEntry(entryId: string): Promise<{ entry?: PromptSheetEntry; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('prompt_sheet_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (error) throw error;

      return { entry: data as PromptSheetEntry };
    } catch (error: any) {
      console.error('Failed to get prompt sheet entry:', error);
      return { error: error.message };
    }
  }

  /**
   * Fetch the revision chain for a specific entry (parent -> child -> child)
   */
  static async getRevisionChain(entryId: string): Promise<{ chain: PromptSheetEntry[]; error?: string }> {
    try {
      // First get the entry to find its parent
      const { data: entry, error: entryError } = await supabase
        .from('prompt_sheet_entries')
        .select('id, parent_entry_id')
        .eq('id', entryId)
        .single();
        
      if (entryError) throw entryError;
      
      // If it has a parent, use that as root, else use this entry as root
      const rootId = entry.parent_entry_id || entry.id;
      
      // Get all entries that share this root (the root itself + all its children)
      const { data, error } = await supabase
        .from('prompt_sheet_entries')
        .select('*')
        .or(`id.eq.${rootId},parent_entry_id.eq.${rootId}`)
        .order('revision_number', { ascending: true });
        
      if (error) throw error;

      return { chain: data as PromptSheetEntry[] };
    } catch (error: any) {
      console.error('Failed to get revision chain:', error);
      return { chain: [], error: error.message };
    }
  }
}
