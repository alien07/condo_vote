import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fetchAuditLogRows } from "@/features/admin/data-modules/documents";
import { auditFiltersFromParams } from "@/features/admin/data-modules/audit-log-params";

export async function GET(request: Request) {
  await requireAdmin({ readOnly: true });

  const supabase = await createClient();
  const url = new URL(request.url);
  const result = await fetchAuditLogRows(supabase, auditFiltersFromParams(url.searchParams));

  return NextResponse.json(result);
}
