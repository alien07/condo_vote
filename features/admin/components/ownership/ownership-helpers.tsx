import { useMessageText } from "@/lib/i18n/staff/client";
import { todayInBangkok } from "@/lib/datetime";
import type { OwnershipActionState } from "@/features/admin/actions";

export type Room = {
  active: boolean | null;
  building?: string | null;
  floor?: string | number | null;
  id: string;
  room_number: string;
};

export type Owner = {
  active: boolean | null;
  email?: string | null;
  full_name: string;
  id: string;
  phone?: string | null;
};

export type RoomOwnerLink = {
  cancelled_at: string | null;
  cancelled_by: string | null;
  ends_at: string | null;
  id: string;
  ownership_role: string;
  owners: {
    full_name: string;
    id?: string;
  } | null;
  rooms: {
    id: string;
    room_number: string;
  } | null;
  starts_at: string | null;
  status: string;
};

export type OwnershipManagerProps = {
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  owners: Owner[];
  roomOwners: RoomOwnerLink[];
  rooms: Room[];
};

export type OwnershipTableState = {
  dir: "asc" | "desc";
  /** Owner id (req_0006), not part of the name. */
  owner: string;
  page: number;
  perPage: number;
  room: string;
  sort: "owner" | "room" | "status";
  status: "active" | "all" | "cancelled" | "ended" | "scheduled";
};

export const initialState: OwnershipActionState = {};

export function fieldErrorId(fieldName: string) {
  return `ownership-${fieldName}-error`;
}

export function fieldProps(fieldName: string, state: OwnershipActionState) {
  const hasError = Boolean(state.fieldErrors?.[fieldName]);

  return {
    "aria-describedby": hasError ? fieldErrorId(fieldName) : undefined,
    "aria-invalid": hasError ? ("true" as const) : undefined,
  };
}

export function FieldError({
  fieldName,
  state,
}: {
  fieldName: string;
  state: OwnershipActionState;
}) {
  const tm = useMessageText();
  const message = state.fieldErrors?.[fieldName];

  return message ? (
    <p className="text-xs font-medium text-red-700" id={fieldErrorId(fieldName)}>
      {tm(message)}
    </p>
  ) : null;
}

export function stateValue(
  state: OwnershipActionState,
  fieldName: string,
  fallback: string | null | undefined = "",
) {
  return state.values?.[fieldName] ?? String(fallback ?? "");
}

export function focusFirstInvalidField(
  form: HTMLFormElement | null,
  state: OwnershipActionState,
) {
  const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0];

  if (!firstInvalidField) {
    return false;
  }

  const field = form?.elements.namedItem(firstInvalidField);
  // A SearchSelect submits through a hidden input; focus its search box.
  const searchBox = form?.querySelector<HTMLElement>(
    `[data-focus-for="${escapeSelectorValue(firstInvalidField)}"]`,
  );
  const element =
    searchBox ??
    (field instanceof RadioNodeList
      ? field[0]
      : field instanceof HTMLElement
        ? field
        : null);

  element?.focus();
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

export function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

export function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ownershipTableStateFromParams(
  params: URLSearchParams,
): OwnershipTableState {
  const sort = params.get("sort");
  const status = params.get("status");

  return {
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    owner: params.get("owner") ?? "",
    page: positiveInteger(params.get("page"), 1),
    perPage: positiveInteger(params.get("perPage"), 25),
    room: params.get("room") ?? "",
    sort: sort === "owner" || sort === "status" ? sort : "room",
    status:
      status === "all" ||
      status === "cancelled" ||
      status === "ended" ||
      status === "scheduled"
        ? status
        : "active",
  };
}

export function ownershipTableParams(state: OwnershipTableState) {
  return {
    dir: state.dir,
    owner: state.owner || null,
    page: state.page > 1 ? String(state.page) : null,
    perPage: String(state.perPage),
    room: state.room || null,
    sort: state.sort,
    status: state.status === "active" ? null : state.status,
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
  return query ? `/admin/ownership?${query}` : "/admin/ownership";
}

export function todayLocalDate() {
  return todayInBangkok();
}

export function ownershipDisplayStatus(link: RoomOwnerLink) {
  if (link.status === "cancelled") {
    return "cancelled";
  }

  const today = todayLocalDate();

  if (link.ends_at && link.ends_at < today) {
    return "ended";
  }

  if (link.starts_at && link.starts_at > today) {
    return "scheduled";
  }

  return "active";
}

export function ActionMessage({ state }: { state: OwnershipActionState }) {
  const tm = useMessageText();
  if (state.error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {tm(state.error)}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {tm(state.success)}
      </p>
    );
  }

  return null;
}
