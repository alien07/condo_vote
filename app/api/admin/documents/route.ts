import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  fetchDocumentRows,
  type DocumentTableFilters,
} from "@/features/admin/data-modules/documents";

function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDocumentFilters(searchParams: URLSearchParams): DocumentTableFilters {
  const sort = searchParams.get("sort");
  const sortBy = sort === "set" || sort === "type" || sort === "created"
    ? sort
    : "created";

  return {
    dir: searchParams.get("dir") === "asc" ? "asc" : "desc",
    page: positiveInteger(searchParams.get("page"), 1),
    perPage: positiveInteger(searchParams.get("perPage"), 25),
    set: searchParams.get("set") ?? undefined,
    sortBy,
    type: searchParams.get("type") ?? undefined,
  };
}

export async function GET(request: Request) {
  await requireAdmin();

  const supabase = await createClient();
  const url = new URL(request.url);
  const result = await fetchDocumentRows(
    supabase,
    getDocumentFilters(url.searchParams),
  );

  return NextResponse.json(result);
}
