"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  answerCorrectionRequest,
  raiseCorrectionLevel,
} from "@/features/results/committee-service";
import { getStaffI18n } from "@/lib/i18n/server";

// Admin side of correction requests (demo feedback item 12): answer every
// request, and raise its level when needed (never lower).

function href(tone: "success" | "error", message: string) {
  return `/admin/results?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

async function run(work: () => Promise<string>) {
  await requireAdmin();
  const t = (await getStaffI18n()).s.committee;
  let target: string;

  try {
    target = href("success", await work());
  } catch (error) {
    target = href("error", error instanceof Error ? error.message : t.couldNotApprove);
  }

  revalidatePath("/admin/results");
  revalidatePath("/committee");
  redirect(target);
}

export async function answerCorrectionAsAdmin(formData: FormData) {
  await run(async () => {
    const t = (await getStaffI18n()).s.committee;
    await answerCorrectionRequest(await createClient(), {
      requestId: String(formData.get("request_id") ?? ""),
      status: formData.get("status") === "no_change" ? "no_change" : "fixed",
      answer: String(formData.get("answer") ?? "").trim(),
    });

    return t.correctionAnswered;
  });
}

export async function raiseCorrectionLevelAsAdmin(formData: FormData) {
  await run(async () => {
    const t = (await getStaffI18n()).s.committee;
    await raiseCorrectionLevel(await createClient(), {
      requestId: String(formData.get("request_id") ?? ""),
      level: String(formData.get("level") ?? ""),
      reason: String(formData.get("reason") ?? "").trim(),
      legalReference: String(formData.get("legal_reference") ?? "").trim() || null,
    });

    return t.correctionLevelSaved;
  });
}
