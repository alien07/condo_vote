"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  approveCloseVoting,
  approveResult,
} from "@/features/results/committee-service";
import { scheduleResultPdfs } from "@/features/results/pdf/schedule";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

function feedbackHref(tone: "success" | "error", message: string) {
  return `/committee?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

async function requireCommittee() {
  const current = await requireProfileWithRoles();

  if (!current.roles.includes("committee") && !current.roles.includes("admin")) {
    redirect(DENIED_PATH);
  }
}

export async function approveResultAsCommittee(formData: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  const t = (await getStaffI18n()).s.committee;
  let href: string;

  try {
    const resultSnapshotId = String(formData.get("result_snapshot_id") ?? "");
    const result = await approveResult(supabase, {
      notes: String(formData.get("notes") ?? "").trim() || null,
      resultSnapshotId,
    });

    if (result.published) {
      await scheduleResultPdfs(resultSnapshotId);
    }

    href = feedbackHref(
      "success",
      result.published
        ? t.approvedPublished
        : fill(t.approvalRecorded, { count: result.approvals, required: result.required }),
    );
  } catch (error) {
    href = feedbackHref("error", error instanceof Error ? error.message : t.couldNotApprove);
  }

  revalidatePath("/committee");
  revalidatePath("/summary");
  redirect(href);
}

export async function approveCloseVotingAsCommittee(formData: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  const t = (await getStaffI18n()).s.committee;
  let href: string;

  try {
    const result = await approveCloseVoting(
      supabase,
      String(formData.get("meeting_id") ?? ""),
    );
    href = feedbackHref(
      "success",
      result.closed
        ? t.closedMessage
        : fill(t.closeRecorded, { count: result.approvals, required: result.required }),
    );
  } catch (error) {
    href = feedbackHref("error", error instanceof Error ? error.message : t.couldNotApprove);
  }

  revalidatePath("/committee");
  revalidatePath("/vote");
  redirect(href);
}
