"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// The owner of record lets a co-owner vote for one room in one meeting, and
// can take it back until the co-owner votes (demo feedback item 15).

function href(tone: "success" | "error", message: string) {
  return `/vote?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

function cleanError(message: string) {
  return message.replace(/^[A-Z_]+:\s*/, "");
}

export async function grantCoOwnerVote(formData: FormData) {
  await requireProfile();
  const { t } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_co_owner_vote", {
    p_meeting_id: String(formData.get("meeting_id") ?? ""),
    p_room_id: String(formData.get("room_id") ?? ""),
    p_co_owner_email: String(formData.get("email") ?? "").trim(),
  });

  revalidatePath("/vote");
  redirect(error ? href("error", cleanError(error.message)) : href("success", t.vote.coOwnerGranted));
}

export async function cancelCoOwnerVote(formData: FormData) {
  await requireProfile();
  const { t } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_co_owner_vote", {
    p_authorization_id: String(formData.get("id") ?? ""),
  });

  revalidatePath("/vote");
  redirect(error ? href("error", cleanError(error.message)) : href("success", t.vote.coOwnerCancelled));
}
