const AUTH_RESPONSE_HEADERS = ["cache-control", "expires", "pragma"] as const;
const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$/;

type ResponseMetadataSource<TCookie> = {
  cookies: {
    getAll(): TCookie[];
  };
  headers: Pick<Headers, "get">;
};

export function getAuthResponseMetadata<TCookie>(response: ResponseMetadataSource<TCookie>) {
  const headers = AUTH_RESPONSE_HEADERS.flatMap((name) => {
    const value = response.headers.get(name);
    return value === null ? [] : [[name, value] as const];
  });

  return {
    cookies: response.cookies.getAll(),
    headers,
  };
}

export function shouldRedirectToLogin(pathname: string, claimsPresent: boolean) {
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/logout");

  return !claimsPresent && !isAuthRoute && !PUBLIC_FILE.test(pathname);
}
