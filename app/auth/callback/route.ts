import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ensureProfile } from "@/features/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = requestUrl.searchParams.get("next");
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const supabase = await createClient();
  let authError: unknown = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
  }

  if (!authError && (code || tokenHash)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await ensureProfile(supabase, user);
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  return NextResponse.redirect(
    new URL("/login?error=auth-callback", requestUrl.origin),
  );
}
