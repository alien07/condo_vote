import { isPrivateHost } from "@/lib/auth/local-bypass";

type HeaderReader = { get(name: string): string | null };

function originOf(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalRun() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return false;
  }

  try {
    return isPrivateHost(new URL(supabaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * The origin the browser actually used, for redirects after sign-in (demo
 * feedback item 3). `request.url` in a route handler names the host the
 * server listens on (localhost), so a phone on the LAN was sent to its own
 * localhost. Only listed hosts are trusted, so a spoofed Host header cannot
 * turn this into an open redirect:
 * - the configured site (NEXT_PUBLIC_APP_URL);
 * - when running locally (Supabase on a private host), localhost and private
 *   LAN addresses.
 * Anything else keeps the old behaviour: the origin of `fallbackUrl`
 * (request.url), which a hosting platform sets from its own routing.
 */
export function getRequestOrigin(headers: HeaderReader, fallbackUrl: string) {
  const configured = originOf(process.env.NEXT_PUBLIC_APP_URL);
  const fallback = originOf(fallbackUrl) ?? configured ?? fallbackUrl;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "")
    .split(",")[0]
    .trim();

  if (!host) {
    return fallback;
  }

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const fallbackProto = originOf(fallbackUrl)?.split(":")[0] ?? "http";
  const proto = forwardedProto === "https" || forwardedProto === "http" ? forwardedProto : fallbackProto;
  const candidate = originOf(`${proto}://${host}`);

  if (!candidate) {
    return fallback;
  }

  if (configured && candidate === configured) {
    return candidate;
  }

  const hostname = new URL(candidate).hostname;

  // 0.0.0.0 is where the server listens, never a page a browser can open.
  if (hostname === "0.0.0.0") {
    return fallback;
  }

  if (isLocalRun() && isPrivateHost(hostname)) {
    return candidate;
  }

  return fallback;
}
