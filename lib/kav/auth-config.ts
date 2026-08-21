const LOCAL_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);
type HeaderReader = Pick<Headers, "get">;

export function shouldCreateAuthUser(email: string) {
  if (process.env.KAV_AUTH_ALLOW_USER_CREATION !== "true") {
    return false;
  }

  const bootstrapEmail = process.env.KAV_BOOTSTRAP_EMAIL?.trim().toLowerCase();

  if (!bootstrapEmail) {
    return true;
  }

  return email.trim().toLowerCase() === bootstrapEmail;
}

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
