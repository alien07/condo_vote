import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Whose document it is, in words (documents review 2026-11-19): a person,
// an owner's proxy, a meeting or a result, with the rooms it concerns. The
// list shows this instead of the document set key, which is often an id.

export type DocumentOwnerRef = { owner_type: string; owner_id: string };

export type DocumentOwner = {
  /** Person, meeting or result name; null when the record is gone. */
  name: string | null;
  /** Room numbers the document concerns. */
  rooms: string[];
  /** Meeting title, for proxies and results. */
  meeting: string | null;
  roomIds: string[];
  ownerIds: string[];
};

export function ownerKey(ref: DocumentOwnerRef) {
  return `${ref.owner_type}:${ref.owner_id}`;
}

function idsOf(refs: DocumentOwnerRef[], type: string) {
  return [...new Set(refs.filter((ref) => ref.owner_type === type).map((ref) => ref.owner_id))];
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** Rooms and owners of record linked to accounts (profiles), not cancelled. */
async function roomsOfProfiles(supabase: SupabaseServerClient, profileIds: string[]) {
  const byProfile = new Map<string, { ownerIds: string[]; rooms: Array<{ id: string; number: string }> }>();

  if (profileIds.length === 0) {
    return byProfile;
  }

  const { data: owners, error } = await supabase
    .from("owners")
    .select("id, profile_id, room_owners(status, rooms(id, room_number))")
    .in("profile_id", profileIds);

  if (error) {
    throw error;
  }

  for (const owner of owners ?? []) {
    if (!owner.profile_id) {
      continue;
    }

    const entry = byProfile.get(owner.profile_id) ?? { ownerIds: [], rooms: [] };

    entry.ownerIds.push(owner.id);
    for (const link of owner.room_owners ?? []) {
      const room = one(link.rooms);

      if (room && link.status !== "cancelled" && !entry.rooms.some((known) => known.id === room.id)) {
        entry.rooms.push({ id: room.id, number: room.room_number });
      }
    }
    byProfile.set(owner.profile_id, entry);
  }

  return byProfile;
}

export async function resolveDocumentOwners(
  supabase: SupabaseServerClient,
  refs: DocumentOwnerRef[],
): Promise<Map<string, DocumentOwner>> {
  const result = new Map<string, DocumentOwner>();
  const profileIds = idsOf(refs, "profile");
  const proxyIds = idsOf(refs, "proxy_authorization");
  const meetingIds = idsOf(refs, "meeting");
  const snapshotIds = idsOf(refs, "result_snapshot");
  const approvalIds = idsOf(refs, "approval_request");
  const empty = { data: [], error: null };
  const [profiles, proxies, meetings, snapshots, approvals] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
      : empty,
    proxyIds.length
      ? supabase
          .from("proxy_authorizations")
          .select("id, owner_id, room_id, rooms(room_number), owners(full_name), meetings(title)")
          .in("id", proxyIds)
      : empty,
    meetingIds.length ? supabase.from("meetings").select("id, title").in("id", meetingIds) : empty,
    snapshotIds.length
      ? supabase.from("result_snapshots").select("id, meetings(title)").in("id", snapshotIds)
      : empty,
    approvalIds.length
      ? supabase
          .from("approval_requests")
          .select(
            "id, profile_id, room_id, rooms(room_number), profiles!approval_requests_profile_id_fkey(full_name, email)",
          )
          .in("id", approvalIds)
      : empty,
  ]);

  for (const response of [profiles, proxies, meetings, snapshots, approvals]) {
    if (response.error) {
      throw response.error;
    }
  }

  const approvalProfileIds = (approvals.data ?? [])
    .map((row) => row.profile_id)
    .filter((id): id is string => Boolean(id));
  const profileRooms = await roomsOfProfiles(supabase, [...new Set([...profileIds, ...approvalProfileIds])]);

  for (const profile of profiles.data ?? []) {
    const linked = profileRooms.get(profile.id);

    result.set(`profile:${profile.id}`, {
      name: profile.full_name ?? profile.email,
      rooms: linked?.rooms.map((room) => room.number) ?? [],
      meeting: null,
      roomIds: linked?.rooms.map((room) => room.id) ?? [],
      ownerIds: linked?.ownerIds ?? [],
    });
  }

  for (const proxy of proxies.data ?? []) {
    const room = one(proxy.rooms);

    result.set(`proxy_authorization:${proxy.id}`, {
      name: one(proxy.owners)?.full_name ?? null,
      rooms: room ? [room.room_number] : [],
      meeting: one(proxy.meetings)?.title ?? null,
      roomIds: proxy.room_id ? [proxy.room_id] : [],
      ownerIds: proxy.owner_id ? [proxy.owner_id] : [],
    });
  }

  for (const meeting of meetings.data ?? []) {
    result.set(`meeting:${meeting.id}`, { name: meeting.title, rooms: [], meeting: null, roomIds: [], ownerIds: [] });
  }

  for (const snapshot of snapshots.data ?? []) {
    result.set(`result_snapshot:${snapshot.id}`, {
      name: one(snapshot.meetings)?.title ?? null,
      rooms: [],
      meeting: null,
      roomIds: [],
      ownerIds: [],
    });
  }

  for (const approval of approvals.data ?? []) {
    const person = one(approval.profiles);
    const room = one(approval.rooms);
    const linked = approval.profile_id ? profileRooms.get(approval.profile_id) : undefined;

    result.set(`approval_request:${approval.id}`, {
      name: person?.full_name ?? person?.email ?? null,
      rooms: room ? [room.room_number] : [],
      meeting: null,
      roomIds: approval.room_id ? [approval.room_id] : [],
      ownerIds: linked?.ownerIds ?? [],
    });
  }

  return result;
}

/**
 * The (owner_type, owner_id) pairs whose documents concern a room or an
 * owner of record, for the room and owner filters. Null when no filter.
 */
export async function documentOwnersFor(
  supabase: SupabaseServerClient,
  filter: { roomId?: string; ownerId?: string },
): Promise<DocumentOwnerRef[] | null> {
  if (!filter.roomId && !filter.ownerId) {
    return null;
  }

  let ownerIds: string[] | null = filter.ownerId ? [filter.ownerId] : null;

  if (filter.roomId) {
    const { data, error } = await supabase
      .from("room_owners")
      .select("owner_id")
      .eq("room_id", filter.roomId)
      .neq("status", "cancelled");

    if (error) {
      throw error;
    }

    const roomOwners = (data ?? []).map((row) => row.owner_id);

    ownerIds = ownerIds ? ownerIds.filter((id) => roomOwners.includes(id)) : roomOwners;
  }

  const refs: DocumentOwnerRef[] = [];
  const { data: owners, error: ownersError } = ownerIds?.length
    ? await supabase.from("owners").select("profile_id").in("id", ownerIds)
    : { data: [], error: null };

  if (ownersError) {
    throw ownersError;
  }

  const profileIds = (owners ?? []).map((owner) => owner.profile_id).filter((id): id is string => Boolean(id));

  profileIds.forEach((id) => refs.push({ owner_type: "profile", owner_id: id }));

  let proxyQuery = supabase.from("proxy_authorizations").select("id");
  let approvalQuery = supabase.from("approval_requests").select("id");

  if (filter.roomId) {
    proxyQuery = proxyQuery.eq("room_id", filter.roomId);
    approvalQuery = approvalQuery.eq("room_id", filter.roomId);
  }

  if (filter.ownerId) {
    proxyQuery = proxyQuery.eq("owner_id", filter.ownerId);
    approvalQuery = approvalQuery.in("profile_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const [proxies, approvals] = await Promise.all([proxyQuery, approvalQuery]);

  if (proxies.error) {
    throw proxies.error;
  }

  if (approvals.error) {
    throw approvals.error;
  }

  (proxies.data ?? []).forEach((row) => refs.push({ owner_type: "proxy_authorization", owner_id: row.id }));
  (approvals.data ?? []).forEach((row) => refs.push({ owner_type: "approval_request", owner_id: row.id }));

  return refs;
}
