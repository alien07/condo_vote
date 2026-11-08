import type {
  ManualVoteTableFilters,
} from "@/features/admin/components/sections/types";

export function manualVoteHref(filters: Required<ManualVoteTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/voting?${params.toString()}`;
}
