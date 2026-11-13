import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export async function ensureProfile(
  supabase: SupabaseServerClient,
  user: User,
) {
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    return existing;
  }

  const email = user.email ?? "";
  const metadata = user.user_metadata;
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : email;

  // A new profile starts in the language chosen before signing in (D020).
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const profile: ProfileInsert = {
    auth_user_id: user.id,
    email,
    full_name: fullName,
    ...(isLocale(cookieLocale) ? { preferred_language: cookieLocale } : {}),
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(profile)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
