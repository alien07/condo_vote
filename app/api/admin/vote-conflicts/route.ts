import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  fetchVoteConflictRows,
  type VoteConflictFilters,
} from "@/features/admin/data-modules/conflicts";

function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getConflictFilters(searchParams: URLSearchParams): VoteConflictFilters {
  const sort = searchParams.get("sort");
  const sortBy =
    sort === "meeting" ||
    sort === "room" ||
    sort === "status" ||
    sort === "resolved_at"
      ? sort
      : "meeting";

  return {
    dir: searchParams.get("dir") === "desc" ? "desc" : "asc",
    meeting: searchParams.get("meeting") ?? undefined,
    page: positiveInteger(searchParams.get("page"), 1),
    perPage: positiveInteger(searchParams.get("perPage"), 25),
    room: searchParams.get("room") ?? undefined,
    sortBy,
    status: searchParams.get("status") ?? undefined,
  };
}

export async function GET(request: Request) {
  await requireAdmin();

  const supabase = await createClient();
  const url = new URL(request.url);
  const result = await fetchVoteConflictRows(
    supabase,
    getConflictFilters(url.searchParams),
  );

  return NextResponse.json(result);
}
