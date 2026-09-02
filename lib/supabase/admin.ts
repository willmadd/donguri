import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS and can manage any auth user. Never
// import this from client code or expose SUPABASE_SERVICE_ROLE_KEY to the
// browser. Only call from trusted server actions that have already checked
// the caller is an admin.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
