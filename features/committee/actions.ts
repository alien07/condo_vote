"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfileWithRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  approvalMessage,
  approveCloseVoting,
  approveResult,
} from "@/features/results/committee-service";

function feedbackHref(tone: "success" | "error", message: string) {
  return `/committee?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

async function requireCommittee() {
  const current = await requireProfileWithRoles();

  if (!current.roles.includes("committee") && !current.roles.includes("admin")) {
    redirect("/summary");
  }
}

export async function approveResultAsCommittee(formData: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  let href: string;

  try {
    const result = await approveResult(supabase, {
      notes: String(formData.get("notes") ?? "").trim() || null,
      resultSnapshotId: String(formData.get("result_snapshot_id") ?? ""),
    });
    href = feedbackHref("success", approvalMessage(result));
  } catch (error) {
    href = feedbackHref("error", error instanceof Error ? error.message : "Could not approve.");
  }

  revalidatePath("/committee");
  revalidatePath("/summary");
  redirect(href);
}

export async function approveCloseVotingAsCommittee(formData: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  let href: string;

  try {
    const result = await approveCloseVoting(
      supabase,
      String(formData.get("meeting_id") ?? ""),
    );
    href = feedbackHref(
      "success",
      result.closed
        ? "Voting closed"
        : `Close approval recorded (${result.approvals} of ${result.required})`,
    );
  } catch (error) {
    href = feedbackHref("error", error instanceof Error ? error.message : "Could not approve.");
  }

  revalidatePath("/committee");
  revalidatePath("/vote");
  redirect(href);
}
