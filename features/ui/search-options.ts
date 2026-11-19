// Option builders for SearchSelect that server components can call too
// (features/ui/search-select.tsx is a client module, so its own builders
// run only in client components).
import type { SearchSelectOption } from "@/features/ui/search-select";

type MeetingLike = {
  id: string;
  title: string;
  meeting_number?: string | null;
  fiscal_year?: number | string | null;
};

/** Meetings by title (2026-11-19). The value is the meeting id, never the
 * title: titles can change or repeat. The meeting number and fiscal year
 * are searchable; the caller says what the hint shows (closing time,
 * status), because each form cares about something different. */
export function meetingSearchOptions<T extends MeetingLike>(
  meetings: T[],
  hint?: (meeting: T) => string | undefined,
): SearchSelectOption[] {
  return meetings.map((meeting) => ({
    value: meeting.id,
    label: meeting.title,
    hint: hint?.(meeting),
    keywords:
      [meeting.meeting_number, meeting.fiscal_year].filter(Boolean).join(" ") || undefined,
  }));
}

type RoomRef = { id: string; room_number: string; building?: string | null };

/** Room filters (2026-11-19): the rooms that appear in a list, once each,
 * in room-number order. The value is the room id, never the number: the
 * same number can repeat across buildings. Inactive rooms stay, because old
 * rows still point at them. */
export function roomFilterOptions(rooms: Array<RoomRef | null | undefined>): SearchSelectOption[] {
  return uniqueById(rooms)
    .sort((left, right) => left.room_number.localeCompare(right.room_number, undefined, { numeric: true }))
    .map((room) => ({ value: room.id, label: room.room_number, hint: room.building ?? undefined }));
}

/** The distinct rows of a list, first seen wins: the meetings or rooms a
 * filter offers, taken from the rows the table shows. */
export function uniqueById<T extends { id: string }>(items: Array<T | null | undefined>): T[] {
  const byId = new Map<string, T>();

  for (const item of items) {
    if (item && !byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}

type OwnerLinkRef = {
  owners: { id?: string; full_name: string } | null;
  rooms: { room_number?: string } | null;
};

/** Owner filters (req_0006, 2026-11-20): the owners that appear in a list of
 * room-owner links, once each, by name. The value is the owner id, never
 * the name: names change and repeat. The hint is their rooms in that list
 * and their email; both are searchable. */
export function ownerFilterOptions(
  links: OwnerLinkRef[],
  emailById: ReadonlyMap<string, string | null | undefined> = new Map(),
): SearchSelectOption[] {
  const roomsByOwner = new Map<string, Set<string>>();

  const linkedOwners: { id: string; full_name: string }[] = [];

  for (const link of links) {
    const ownerId = link.owners?.id;

    if (ownerId) {
      const owned = roomsByOwner.get(ownerId) ?? new Set<string>();

      if (link.rooms?.room_number) {
        owned.add(link.rooms.room_number);
      }

      roomsByOwner.set(ownerId, owned);
      linkedOwners.push({ id: ownerId, full_name: link.owners?.full_name ?? "" });
    }
  }

  return uniqueById(linkedOwners)
    .sort((left, right) => left.full_name.localeCompare(right.full_name))
    .map((owner) => {
      const owned = [...(roomsByOwner.get(owner.id) ?? [])].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
      const email = emailById.get(owner.id) ?? undefined;
      const hint = [owned.join(", "), email].filter(Boolean).join(" · ");

      return {
        value: owner.id,
        label: owner.full_name,
        hint: hint || undefined,
        keywords: [email, ...owned].filter(Boolean).join(" ") || undefined,
      };
    });
}
