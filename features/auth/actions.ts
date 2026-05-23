"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

async function getRedirectOrigin() {
  const requestOrigin = (await headers()).get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (!requestOrigin) {
    return null;
  }

  const url = new URL(requestOrigin);

  if (url.hostname === "0.0.0.0") {
    return null;
  }

  return requestOrigin;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await getRedirectOrigin();

  if (!origin) {
    redirect("/login?error=missing-origin");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/login?error=google-login");
}

export async function signInWithEmail(
  _previousState: LoginState,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const origin = await getRedirectOrigin();

  if (!email) {
    return { error: "Email is required." };
  }

  if (!origin) {
    return { error: "Missing request origin." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
