import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const canonicalAppUrl = process.env.APP_CANONICAL_URL ?? "http://127.0.0.1:3000";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host.split(":")[0] === "0.0.0.0") {
    const url = request.nextUrl.clone();
    const canonicalUrl = new URL(canonicalAppUrl);

    url.protocol = canonicalUrl.protocol;
    url.hostname = canonicalUrl.hostname;
    url.port = canonicalUrl.port;

    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
