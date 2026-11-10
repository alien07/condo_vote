import { cookies, headers } from "next/headers";

// The app's own origin and the user's cookies, so headless Chromium can open
// the result pages as the signed-in user (D021).
export async function pdfRequestContext() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const local = Boolean(host?.startsWith("localhost") || host?.startsWith("127."));
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (local ? "http" : "https");

  return {
    origin: `${protocol}://${host}`,
    cookies: (await cookies()).getAll().map(({ name, value }) => ({ name, value })),
  };
}
