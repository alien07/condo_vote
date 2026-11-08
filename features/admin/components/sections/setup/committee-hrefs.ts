import type {
  CommitteeTableFilters,
} from "@/features/admin/components/sections/types";

export function committeeHref(filters: Required<CommitteeTableFilters>) {
  const params = new URLSearchParams();

  params.set("tab", "committee");
  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.memberName) {
    params.set("memberName", filters.memberName);
  }

  if (filters.position) {
    params.set("position", filters.position);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/setup?${params.toString()}`;
}

export function committeeDrawerHref(
  listHref: string,
  drawer: { id?: string; mode: "create" | "edit" },
) {
  const [pathname, query = ""] = listHref.split("?");
  const params = new URLSearchParams(query);

  params.set("mode", drawer.mode);
  params.set("type", "committee_member");

  if (drawer.id) {
    params.set("id", drawer.id);
  }

  return `${pathname}?${params.toString()}`;
}
