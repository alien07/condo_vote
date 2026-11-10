"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";
import { createClient } from "@/lib/supabase/server";

// Language switcher (D020): remembered in this browser and, when signed in,
// saved to the profile so emails use it too.
export async function setLanguage(formData: FormData) {
  const language = formData.get("language");

  if (!isLocale(language)) {
    return;
  }

  (await cookies()).set(LOCALE_COOKIE, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase.rpc("set_preferred_language", { language });

    if (error) {
      throw error;
    }
  }

  revalidatePath("/", "layout");
}
