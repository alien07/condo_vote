"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { getStaffI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { translateToEnglish } from "@/lib/translation";
import type { Json } from "@/lib/supabase/database.types";

/** Drafts English for the given Thai texts (admin only, item 6b). */
export async function translateTexts(texts: string[]) {
  await requireAdmin();

  try {
    return { ok: true as const, texts: await translateToEnglish(texts.slice(0, 200)) };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Translation failed." };
  }
}

export async function saveMeetingEnglish(formData: FormData) {
  await requireAdmin();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const { s } = await getStaffI18n();
  let text: Json = {};

  try {
    text = JSON.parse(String(formData.get("text_json") ?? "{}")) as Json;
  } catch {
    text = {};
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_meeting_english", {
    p_meeting_id: meetingId,
    p_text: text,
    p_checked: formData.get("checked") === "on",
  });
  const target = `/admin/meetings/${meetingId}/english?feedback=${error ? "error" : "success"}&message=${encodeURIComponent(
    error ? error.message.replace(/^[A-Z_]+:\s*/, "") : s.english.saved,
  )}`;

  revalidatePath(`/admin/meetings/${meetingId}/english`);
  revalidatePath("/admin/meetings");
  redirect(target);
}
