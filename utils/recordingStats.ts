import { supabase } from '../lib/supabase';

export interface UserRecordingStats {
  total_time_recorded_ms: number;
  recording_count: number;
  last_updated: string;
}

/**
 * Increment user's total recording time in Supabase
 * @param durationMs Duration of the recording in milliseconds
 */
export async function incrementRecordingTime(durationMs: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user found, skipping recording time update');
      return;
    }

    // Get current stats
    const { data: existingStats, error: fetchError } = await supabase
      .from('user_recording_stats')
      .select('total_time_recorded_ms, recording_count')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching recording stats:', fetchError);
      throw fetchError;
    }

    const currentTotal = existingStats?.total_time_recorded_ms || 0;
    const currentCount = existingStats?.recording_count || 0;
    const newTotal = currentTotal + durationMs;
    const newCount = currentCount + 1;

    // Upsert the stats
    const { error: upsertError } = await supabase
      .from('user_recording_stats')
      .upsert({
        user_id: user.id,
        total_time_recorded_ms: newTotal,
        recording_count: newCount,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error updating recording stats:', upsertError);
      throw upsertError;
    }

    console.log(`Recording time updated: ${durationMs}ms added, new total: ${newTotal}ms`);
  } catch (error) {
    console.error('Error incrementing recording time:', error);
    // Don't throw - we don't want to fail the save if stats update fails
  }
}

/**
 * Get user's recording statistics from Supabase
 */
export async function getUserRecordingStats(): Promise<UserRecordingStats | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_recording_stats')
      .select('total_time_recorded_ms, recording_count, last_updated')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No stats found, return default
        return {
          total_time_recorded_ms: 0,
          recording_count: 0,
          last_updated: new Date().toISOString(),
        };
      }
      console.error('Error fetching recording stats:', error);
      return null;
    }

    return {
      total_time_recorded_ms: data?.total_time_recorded_ms || 0,
      recording_count: data?.recording_count || 0,
      last_updated: data?.last_updated || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting recording stats:', error);
    return null;
  }
}

