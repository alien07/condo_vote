"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateResultPdfs } from "@/features/results/pdf/generate";
import { pdfRequestContext } from "@/features/results/pdf/request";
import { DENIED_PATH, requireProfileWithRoles } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { createClient } from "@/lib/supabase/server";

function backHref(tone: "success" | "error", message: string) {
  return `/admin/results?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

// "Create PDF files" on the results list: makes any missing master PDF files
// of a published result and waits for them (D021).
export async function createResultPdfs(formData: FormData) {
  const current = await requireProfileWithRoles();

  if (!current.roles.includes("admin") && !current.roles.includes("committee")) {
    redirect(DENIED_PATH);
  }

  const snapshotId = String(formData.get("result_snapshot_id") ?? "");
  const supabase = await createClient();
  let href: string;

  try {
    const { created } = await generateResultPdfs({
      supabase,
      snapshotId,
      ...(await pdfRequestContext()),
    });

    await writeAuditLog(supabase, {
      action: "result_documents.created",
      actorProfileId: current.profile.id,
      details: { created },
      entityId: snapshotId,
      entityType: "result_snapshot",
    });
    href = backHref("success", created > 0 ? `Created ${created} PDF file(s).` : "PDF files already exist.");
  } catch (error) {
    href = backHref(
      "error",
      `Could not create PDF files: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  revalidatePath("/admin/results");
  redirect(href);
}
