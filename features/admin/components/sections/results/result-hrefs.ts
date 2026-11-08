import type {
  ResultTableFilters,
} from "@/features/admin/components/sections/types";

export function resultHref(filters: Required<ResultTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.generated) {
    params.set("generated", filters.generated);
  }

  if (filters.approval && filters.approval !== "all") {
    params.set("approval", filters.approval);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/results?${params.toString()}`;
}
