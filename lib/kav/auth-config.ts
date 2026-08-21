const LOCAL_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);
type HeaderReader = Pick<Headers, "get">;

export function getAuthCallbackUrl(headersList: HeaderReader, nextPath: string) {
  const host =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "127.0.0.1:3000";
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (LOCAL_HOSTS.has(host) ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return `${origin}/auth/confirm?next=${encodeURIComponent(sanitizeNextPath(nextPath))}`;
}

export function getAuthConfirmationNext(type: string | null, nextPath: string | null) {
  if (type === "recovery") return "/account/update-password";
  return sanitizeNextPath(nextPath ?? "/");
}

export function sanitizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(value, "https://kav.local");

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}
