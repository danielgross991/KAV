import { cookies } from "next/headers";

import { lineCookieName } from "@/lib/kav/line-selection";

export async function getSelectedLinePeriodId(teamSlug: string) {
  return (await cookies()).get(lineCookieName(teamSlug))?.value ?? null;
}

