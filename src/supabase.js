import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qnzrrfisftejsygiiwza.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tMF_5_QaFCAHpaJH8lx1qQ_p21-3ZpY';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isValidUUID = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

// Current logged in session helper (in localStorage)
export const Session = {
  get() {
    try {
      const data = localStorage.getItem('agri_auth_session');
      if (!data) return null;
      const user = JSON.parse(data);
      // Auto-clear stale demo sessions with non-UUID identifiers when live Supabase is active
      if (isSupabaseConfigured && user?.role === 'dealer' && user.dealer && !isValidUUID(user.dealer.id)) {
        console.warn('Clearing stale demo session with invalid UUID:', user.dealer.id);
        localStorage.removeItem('agri_auth_session');
        return null;
      }
      return user;
    } catch {
      return null;
    }
  },
  set(user) {
    localStorage.setItem('agri_auth_session', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('agri_auth_session');
  }
};
