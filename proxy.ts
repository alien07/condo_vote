import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const canonicalAppUrl = process.env.APP_CANONICAL_URL ?? "http://127.0.0.1:3000";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends the browser to an absolute URL on another host.
 *
 * NextResponse.redirect() is not used here: Next.js relativizes the Location
 * header when the target host matches the server host (127.0.0.1), so a
 * browser on 0.0.0.0 would stay on 0.0.0.0. The Refresh header and meta tag
 * keep the absolute URL.
 */
function canonicalHostResponse(target: string) {
  const escaped = escapeHtml(target);

  return new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${escaped}"><a href="${escaped}">Continue</a>`,
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        Refresh: `0; url=${target}`,
      },
    },
  );
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host.split(":")[0] === "0.0.0.0") {
    const url = request.nextUrl.clone();
    const canonicalUrl = new URL(canonicalAppUrl);

    url.protocol = canonicalUrl.protocol;
    url.hostname = canonicalUrl.hostname;
    url.port = canonicalUrl.port;

    return canonicalHostResponse(url.toString());
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
