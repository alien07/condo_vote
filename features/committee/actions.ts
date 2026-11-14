"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  answerCloseRequest,
  approveResult,
  cancelCloseRequest,
  proposeCloseVoting,
  requestResultCorrection,
} from "@/features/results/committee-service";
import { bangkokLocalToIso } from "@/lib/datetime";
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

async function runAndRedirect(
  work: (t: Awaited<ReturnType<typeof getStaffI18n>>["s"]["committee"]) => Promise<string>,
) {
  await requireCommittee();
  const t = (await getStaffI18n()).s.committee;
  let href: string;

  try {
    href = feedbackHref("success", await work(t));
  } catch (error) {
    href = feedbackHref("error", error instanceof Error ? error.message : t.couldNotApprove);
  }

  revalidatePath("/committee");
  revalidatePath("/vote");
  redirect(href);
}

function statusMessage(
  t: Awaited<ReturnType<typeof getStaffI18n>>["s"]["committee"],
  status: string,
  fallback: string,
) {
  if (status === "approved") {
    return t.requestApproved;
  }

  if (status === "failed") {
    return t.requestFailed;
  }

  return fallback;
}

/** Propose closing voting early (demo feedback item 10). */
export async function proposeCloseAsCommittee(formData: FormData) {
  await runAndRedirect(async (t) => {
    const supabase = await createClient();
    const when = String(formData.get("when") ?? "now");
    const closeAt = when === "at" ? bangkokLocalToIso(String(formData.get("close_at") ?? "")) : null;

    // "At this time" without a time must not become "as soon as approved".
    if (when === "at" && !closeAt) {
      throw new Error(t.proposeAtMissing);
    }

    const result = await proposeCloseVoting(supabase, {
      meetingId: String(formData.get("meeting_id") ?? ""),
      reason: String(formData.get("reason") ?? "").trim(),
      closeAt,
    });

    return statusMessage(t, result.status, t.proposed);
  });
}

export async function answerCloseAsCommittee(formData: FormData) {
  await runAndRedirect(async (t) => {
    const supabase = await createClient();
    const answer = formData.get("answer") === "object" ? "object" : "approve";
    const result = await answerCloseRequest(supabase, {
      requestId: String(formData.get("request_id") ?? ""),
      answer,
      reason: String(formData.get("reason") ?? "").trim() || null,
    });

    return statusMessage(t, result.status, t.answered);
  });
}

export async function cancelCloseAsCommittee(formData: FormData) {
  await runAndRedirect(async (t) => {
    const supabase = await createClient();
    await cancelCloseRequest(supabase, String(formData.get("request_id") ?? ""));

    return t.requestCancelled;
  });
}

/** Ask the admin to correct a result (demo feedback item 12). */
export async function requestCorrectionAsCommittee(formData: FormData) {
  await runAndRedirect(async (t) => {
    const supabase = await createClient();
    await requestResultCorrection(supabase, {
      resultSnapshotId: String(formData.get("result_snapshot_id") ?? ""),
      category: String(formData.get("category") ?? ""),
      reason: String(formData.get("reason") ?? "").trim(),
      legalReference: String(formData.get("legal_reference") ?? "").trim() || null,
    });

    return t.correctionSent;
  });
}
