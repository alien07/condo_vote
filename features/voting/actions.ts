"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  answersFromFormData,
  submitOnlineBallot,
} from "@/features/voting/core/ballot-service";

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

export async function submitBallot(formData: FormData) {
  await requireProfile();
  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const roomId = requiredText(formData.get("room_id"), "Room");
  const supabase = await createClient();

  // Eligibility, voting window, room lock, answer validation, version history,
  // and audit run in one transaction in the voting core service.
  await submitOnlineBallot(supabase, {
    meetingId,
    roomId,
    answers: answersFromFormData(formData),
  });

  revalidatePath("/vote");
  revalidatePath(`/vote/${meetingId}/${roomId}`);
}
