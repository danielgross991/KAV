import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}
