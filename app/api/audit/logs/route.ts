import { NextResponse } from "next/server";
import { requireAuditReader } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fetchAuditLogRows } from "@/features/admin/data-modules/documents";
import { auditFiltersFromParams } from "@/features/admin/data-modules/audit-log-params";

// The audit page's activity log (req_0007): auditors and the manager, rows
// as RLS lets them read, optionally about one meeting (?meeting=<id>).
export async function GET(request: Request) {
  await requireAuditReader({ readOnly: true });

  const supabase = await createClient();
  const url = new URL(request.url);
  const result = await fetchAuditLogRows(supabase, {
    ...auditFiltersFromParams(url.searchParams),
    meetingId: url.searchParams.get("meeting") || undefined,
  });

  return NextResponse.json(result);
}
