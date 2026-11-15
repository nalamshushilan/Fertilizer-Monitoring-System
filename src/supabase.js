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

// Current logged in session helper (in localStorage)
export const Session = {
  get() {
    try {
      const data = localStorage.getItem('agri_auth_session');
      return data ? JSON.parse(data) : null;
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
