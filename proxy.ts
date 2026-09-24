import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    path.startsWith(route),
  );
  const isAuthRoute = AUTH_ROUTES.includes(path);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run any logic between createServerClient and getClaims() —
  // it refreshes the auth token and must run on every request. getClaims()
  // verifies the JWT's signature locally against the project's (cached)
  // asymmetric signing keys, where getUser() made a round trip to the
  // Supabase auth server on every navigation (~350-480ms measured). The
  // trade-off: a session revoked server-side stays usable until its access
  // token expires (default 1 hour), rather than failing immediately.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Scoped to exactly the routes that read `user` below (PROTECTED_ROUTES +
// AUTH_ROUTES) — statically excluding the whole public site (marketing
// pages, /chat, static assets, ...) means Next.js skips invoking the proxy
// for those requests entirely, rather than running it and immediately
// returning. Every one of those navigations used to pay a full Supabase
// auth-server round-trip for a `user` value it never used; none of those
// routes read the session via lib/dal.ts either (grep confirms it), so this
// is a pure latency win, not a security trade-off — that route tree simply
// isn't session-gated.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
