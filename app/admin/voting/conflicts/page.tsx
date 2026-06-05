import Link from "next/link";
import { ListChecks } from "lucide-react";
import {
  VoteConflictsTable,
  type VoteConflictRow,
} from "@/features/admin/components/vote-conflicts-table";
import {
  fetchVoteConflictRows,
  type VoteConflictFilters,
} from "@/features/admin/data-modules/conflicts";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

type AdminVoteConflictsPageProps = {
  searchParams: Promise<{
    dir?: string;
    meeting?: string;
    page?: string;
    perPage?: string;
    room?: string;
    sort?: string;
    status?: string;
  }>;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getConflictFilters(
  params: Awaited<AdminVoteConflictsPageProps["searchParams"]>,
): VoteConflictFilters {
  const sortBy =
    params.sort === "meeting" ||
    params.sort === "room" ||
    params.sort === "status" ||
    params.sort === "resolved_at"
      ? params.sort
      : "meeting";

  return {
    dir: params.dir === "desc" ? "desc" : "asc",
    meeting: params.meeting,
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    room: params.room,
    sortBy,
    status: params.status,
  };
}

export default async function AdminVoteConflictsPage({
  searchParams,
}: AdminVoteConflictsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const filters = getConflictFilters(params);
  const supabase = await createClient();
  const conflictRows = await fetchVoteConflictRows(supabase, filters);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <ListChecks className="text-[var(--primary)]" size={26} />
              <div>
                <Link className="text-sm text-[var(--muted)]" href="/admin/voting">
                  Back to manual votes
                </Link>
                <h1 className="mt-1 text-2xl font-semibold">
                  Manual/Online Conflicts
                </h1>
                <p className="text-sm text-[var(--muted)]">
                  Review rooms with both manual and online votes, then choose the
                  effective source for the whole ballot.
                </p>
              </div>
            </div>
          </div>
        </div>

        <VoteConflictsTable
          initialFilters={{
            dir: filters.dir ?? "asc",
            meeting: filters.meeting ?? "",
            page: conflictRows.conflictPage,
            perPage: conflictRows.conflictPerPage,
            room: filters.room ?? "",
            sort: filters.sortBy ?? "meeting",
            status: filters.status ?? "all",
          }}
          initialPage={conflictRows.conflictPage}
          initialPerPage={conflictRows.conflictPerPage}
          initialRows={conflictRows.conflicts as VoteConflictRow[]}
          initialTotal={conflictRows.conflictTotal}
        />
      </section>
    </main>
  );
}
