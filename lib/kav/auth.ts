import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type AuthContext = Awaited<ReturnType<typeof requireAuth>>;

export const requireAuth = cache(async function requireAuth() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return {
    claims: data.claims,
    supabase,
    userId: data.claims.sub,
  };
});
