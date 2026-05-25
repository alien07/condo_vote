"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ERROR_CODES } from "@/lib/error-codes";
import { createClient } from "@/lib/supabase/server";

function getSafeNext(value: FormDataEntryValue | string | null) {
  const next = String(value ?? "").trim();

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

async function getRedirectOrigin() {
  const requestOrigin = (await headers()).get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (requestOrigin) {
    const url = new URL(requestOrigin);

    if (url.hostname !== "0.0.0.0") {
      return requestOrigin;
    }
  }

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return null;
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = await getRedirectOrigin();
  const next = getSafeNext(formData.get("next"));

  if (!origin) {
    redirect(`/login?error=${ERROR_CODES.AUTH_MISSING_ORIGIN}`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${ERROR_CODES.AUTH_GOOGLE_PROVIDER}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect(`/login?error=${ERROR_CODES.AUTH_GOOGLE_REDIRECT_MISSING}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
