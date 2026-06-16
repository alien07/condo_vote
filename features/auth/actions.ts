"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ERROR_CODES } from "@/lib/error-codes";
import { debugAction } from "@/lib/debug/action-log";
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

function getServiceRoleKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function isPrivateHost(hostname: string) {
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
    return true;
  }

  if (hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
    return true;
  }

  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function getRequestHostname() {
  const host = (await headers()).get("host") ?? "";
  return host.split(":")[0] ?? "";
}

export async function isLocalAuthBypassAvailable() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (process.env.ENABLE_LOCAL_AUTH_BYPASS === "0") {
    return false;
  }

  const hostname = await getRequestHostname();

  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      getServiceRoleKey() &&
      isPrivateHost(hostname),
  );
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = await getRedirectOrigin();
  const next = getSafeNext(formData.get("next"));

  debugAction("auth.google.start", {
    hasOrigin: Boolean(origin),
    next,
  });

  if (!origin) {
    debugAction("auth.google.missing_origin", { next });
    redirect(`/login?error=${ERROR_CODES.AUTH_MISSING_ORIGIN}`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    debugAction("auth.google.provider_error", {
      message: error.message,
      next,
    });
    redirect(`/login?error=${ERROR_CODES.AUTH_GOOGLE_PROVIDER}`);
  }

  if (data.url) {
    debugAction("auth.google.redirect", {
      next,
      provider: "google",
    });
    redirect(data.url);
  }

  debugAction("auth.google.redirect_missing", { next });
  redirect(`/login?error=${ERROR_CODES.AUTH_GOOGLE_REDIRECT_MISSING}`);
}

export async function signOut() {
  const supabase = await createClient();
  debugAction("auth.sign_out.start");
  await supabase.auth.signOut();
  debugAction("auth.sign_out.complete");
  redirect("/");
}
