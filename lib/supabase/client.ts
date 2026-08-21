import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const { publishableKey, url } = getSupabaseEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
