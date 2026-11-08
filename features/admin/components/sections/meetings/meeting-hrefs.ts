import type {
  MeetingTableFilters,
} from "@/features/admin/components/sections/types";

export function meetingHref(filters: Required<MeetingTableFilters>) {
  const params = new URLSearchParams();

  params.set("tab", "meetings");
  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.title) {
    params.set("title", filters.title);
  }

  if (filters.noType) {
    params.set("noType", filters.noType);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/meetings?${params.toString()}`;
}

export function meetingDrawerHref(
  listHref: string,
  drawer: { id?: string; mode: "create" | "edit" },
) {
  const [pathname, query = ""] = listHref.split("?");
  const params = new URLSearchParams(query);

  params.set("mode", drawer.mode);
  params.set("type", "meeting");

  if (drawer.id) {
    params.set("id", drawer.id);
  }

  return `${pathname}?${params.toString()}`;
}
