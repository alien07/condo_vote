// Local demo sign-in without Google (D016 local workflow, demo personas).
// Allowed only on a private host (localhost / LAN) with a service key.
// `next dev`: on unless ENABLE_LOCAL_AUTH_BYPASS=0.
// `next start` (production build): off unless ENABLE_LOCAL_AUTH_BYPASS=1 AND
// the Supabase URL is itself local, so a hosted deployment can never enable
// it by accident or through a spoofed Host header.

export function getServiceRoleKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isPrivateHost(hostname: string) {
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname)) {
    return true;
  }

  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    return true;
  }

  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function isLocalSupabaseUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    return isPrivateHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isLocalBypassEnabled(hostname: string) {
  const flag = process.env.ENABLE_LOCAL_AUTH_BYPASS;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (flag === "0" || !supabaseUrl || !getServiceRoleKey()) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    if (flag !== "1" || !isLocalSupabaseUrl(supabaseUrl)) {
      return false;
    }
  }

  return isPrivateHost(hostname);
}
