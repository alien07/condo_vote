import { cookies } from "next/headers";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";

/** Language for this request: the switcher cookie, then the signed-in
 * profile, then Thai (D020). */
export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (isLocale(data?.preferred_language)) {
      return data.preferred_language;
    }
  }

  return DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();

  return { locale, t: getDictionary(locale) };
}
