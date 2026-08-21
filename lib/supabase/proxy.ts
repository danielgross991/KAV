import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$/;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { publishableKey, url } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/logout");

  if (!data?.claims && !isAuthRoute && !PUBLIC_FILE.test(pathname)) {
    const urlToRedirect = request.nextUrl.clone();
    urlToRedirect.pathname = "/login";
    urlToRedirect.searchParams.set("next", pathname);
    return NextResponse.redirect(urlToRedirect);
  }

  return supabaseResponse;
}
