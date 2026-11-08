import type {
  EmailTableFilters,
} from "@/features/admin/components/sections/types";

export function emailHref(filters: Required<EmailTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.recipient) {
    params.set("recipient", filters.recipient);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.created) {
    params.set("created", filters.created);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/communications?${params.toString()}`;
}
