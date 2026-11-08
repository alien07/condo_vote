import type { OwnerTableState, ProfileTableState, RoomTableState } from "@/features/admin/components/sections/people/people-types";

export function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function roomTableStateFromParams(params: URLSearchParams): RoomTableState {
  const sort = params.get("sort");
  const status = params.get("status");

  return {
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    room: params.get("room") ?? "",
    sort: sort === "status" ? "status" : "room",
    status:
      status === "active" || status === "inactive" || status === "all"
        ? status
        : "all",
  };
}

export function roomTableParams(state: RoomTableState) {
  return {
    dir: state.dir,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    room: state.room || null,
    sort: state.sort,
    status: state.status === "all" ? null : state.status,
  };
}

export function ownerTableStateFromParams(params: URLSearchParams): OwnerTableState {
  const sort = params.get("sort");
  const status = params.get("status");

  return {
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    name: params.get("name") ?? "",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    sort: sort === "status" ? "status" : "name",
    status:
      status === "active" || status === "inactive" || status === "all"
        ? status
        : "all",
  };
}

export function ownerTableParams(state: OwnerTableState) {
  return {
    dir: state.dir,
    name: state.name || null,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    sort: state.sort,
    status: state.status === "all" ? null : state.status,
  };
}

export function profileTableStateFromParams(params: URLSearchParams): ProfileTableState {
  const defaultStatus = params.get("defaultStatus");
  const sort = params.get("sort");

  return {
    defaultStatus:
      defaultStatus === "owner" ||
      defaultStatus === "resident" ||
      defaultStatus === "proxy" ||
      defaultStatus === "all"
        ? defaultStatus
        : "all",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    name: params.get("name") ?? "",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    sort: sort === "default_status" ? "default_status" : "name",
  };
}

export function profileTableParams(state: ProfileTableState) {
  return {
    defaultStatus:
      state.defaultStatus === "all" ? null : state.defaultStatus,
    dir: state.dir,
    name: state.name || null,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    sort: state.sort,
  };
}

export function mergeParams(
  currentParams: URLSearchParams,
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(currentParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "/admin/people";
}

export function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}
