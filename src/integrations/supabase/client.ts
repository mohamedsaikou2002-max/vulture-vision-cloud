import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
// Public workspace: no auth storage, login, anonymous sign-up or token refresh.
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
