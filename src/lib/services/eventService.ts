import { supabase } from '../supabase';

export class EventService {
  static async getEventRounds(eventId: string) {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('event_id', eventId)
      .order('order_index');

    if (error) {
      console.error('Failed to fetch event rounds', error);
      return [];
    }

    return rounds || [];
  }
}
