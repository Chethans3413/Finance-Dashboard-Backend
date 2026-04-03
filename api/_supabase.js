import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (service role). Never expose this key to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
