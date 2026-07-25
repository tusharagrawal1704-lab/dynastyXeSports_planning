import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

console.log(`[Supabase] Configured: ${isSupabaseConfigured}, URL: ${supabaseUrl ? 'SET' : 'MISSING'}, Key: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'MISSING'}`);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Test Supabase connection on load
if (supabase) {
  supabase.from('rooms').select('id').limit(1).then(({ data, error }) => {
    if (error) {
      console.error('[Supabase] DB connection FAILED:', error.message);
    } else {
      console.log('[Supabase] DB connection SUCCESS ✅ Rooms accessible:', data);
    }
  });
}
