import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // the proxy also refreshes the session on every request.
          }
        },
      },
    },
  );

  // lib/dal.ts's getSession() reads `auth.getSession().data.session.user`
  // (a cookie read, not a network call — see the comment there for why
  // that's safe here). The SDK's own getSession() otherwise wraps that
  // `user` in a Proxy that logs an "insecure" warning on first property
  // access, on every request — accurate advice in general, just not for
  // this app's specific setup, where the proxy already validated the JWT
  // moments earlier in the same request. `suppressGetSessionWarning` is
  // protected, not a public option, hence the cast.
  (
    supabase.auth as unknown as { suppressGetSessionWarning: boolean }
  ).suppressGetSessionWarning = true;

  return supabase;
}
