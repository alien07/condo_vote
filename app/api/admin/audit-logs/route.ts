import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAuditLogRows,
  type AuditLogFilters,
} from "@/features/admin/data-modules/documents";

function getActions(searchParams: URLSearchParams) {
  const repeated = searchParams.getAll("actions").filter(Boolean);
  const commaSeparated = searchParams
    .get("actions")
    ?.split(",")
    .filter(Boolean);

  return repeated.length > 0 ? repeated : commaSeparated ?? [];
}

function getAuditFilters(searchParams: URLSearchParams): AuditLogFilters {
  const sort = searchParams.get("sort");
  const sortBy =
    sort === "actor" || sort === "action" || sort === "entity" || sort === "time"
      ? sort
      : "time";
  const page = Number(searchParams.get("page"));
  const perPage = Number(searchParams.get("perPage"));

  return {
    actions: getActions(searchParams),
    actorProfileId: searchParams.get("actor") ?? undefined,
    dateFrom: searchParams.get("from") ?? undefined,
    dateTo: searchParams.get("to") ?? undefined,
    page: Number.isFinite(page) ? page : 1,
    perPage: Number.isFinite(perPage) ? perPage : 25,
    sortBy,
    sortDirection: searchParams.get("dir") === "asc" ? "asc" : "desc",
  };
}

export async function GET(request: Request) {
  await requireAdmin();

  const supabase = await createClient();
  const url = new URL(request.url);
  const result = await fetchAuditLogRows(supabase, getAuditFilters(url.searchParams));

  return NextResponse.json(result);
}
