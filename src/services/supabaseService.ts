import { supabase, isSupabaseConfigured } from './supabaseClient';
import { useStrategyStore } from '@/store/strategyStore';

/**
 * Fetch initial room state from Supabase DB
 */
export async function fetchRoomState(roomId: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const cleanId = roomId.trim().toUpperCase();
    const { data, error } = await supabase
      .from('rooms')
      .select('state')
      .eq('id', cleanId)
      .single();

    if (error) {
      console.warn('[Supabase DB Fetch Notice]', error.message);
      return null;
    }
    return data?.state || null;
  } catch (e) {
    return null;
  }
}

/**
 * Save / Upsert room state to Supabase DB
 */
export async function saveRoomState(roomId: string, stateSnapshot: any) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const cleanId = roomId.trim().toUpperCase();
    const payload = {
      id: cleanId,
      state: {
        markers: stateSnapshot.markers || [],
        players: stateSnapshot.players || [],
        drawings: stateSnapshot.drawings || [],
        safeZones: stateSnapshot.safeZones || [],
        flightPaths: stateSnapshot.flightPaths || [],
        vehiclePaths: stateSnapshot.vehiclePaths || [],
      },
      updated_at: new Date().toISOString(),
    };

    await supabase.from('rooms').upsert(payload, { onConflict: 'id' });
  } catch (e) {
    console.warn('[Supabase Save Error]', e);
  }
}
