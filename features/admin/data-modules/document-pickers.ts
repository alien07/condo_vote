import type { createClient } from "@/lib/supabase/server";
import { resolveDocumentOwners } from "@/features/admin/data-modules/document-owners";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** Rooms and owners that some document concerns, for the list filters. */
export async function fetchDocumentFilterChoices(supabase: SupabaseServerClient) {
  const { data: refs, error } = await supabase
    .from("documents")
    .select("owner_type, owner_id")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    throw error;
  }

  const owners = await resolveDocumentOwners(supabase, refs ?? []);
  const roomIds = [...new Set([...owners.values()].flatMap((owner) => owner.roomIds))];
  const ownerIds = [...new Set([...owners.values()].flatMap((owner) => owner.ownerIds))];
  const empty = { data: [], error: null };
  const [rooms, ownerRows] = await Promise.all([
    roomIds.length
      ? supabase.from("rooms").select("id, room_number, building").in("id", roomIds)
      : empty,
    ownerIds.length
      ? supabase.from("owners").select("id, full_name, email, phone, active").in("id", ownerIds)
      : empty,
  ]);

  if (rooms.error) {
    throw rooms.error;
  }

  if (ownerRows.error) {
    throw ownerRows.error;
  }

  return { rooms: rooms.data ?? [], owners: ownerRows.data ?? [] };
}

export type DocumentPickerOption = { value: string; label: string; hint?: string; keywords?: string };

/**
 * Choices for "whose document" in the register form, one list per kind,
 * each submitting the record id (code-organization rule 8). Hints are
 * plain data (room numbers, emails, meeting titles); the form adds words.
 */
export async function fetchDocumentOwnerChoices(supabase: SupabaseServerClient) {
  const [profiles, proxies, meetings, snapshots, approvals] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, owners(room_owners(status, rooms(room_number)))")
      .order("full_name", { ascending: true })
      .limit(2000),
    supabase
      .from("proxy_authorizations")
      .select("id, status, rooms(room_number), owners(full_name), meetings(title)")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("meetings")
      .select("id, title, meeting_number, fiscal_year")
      .order("starts_at", { ascending: false })
      .limit(500),
    supabase
      .from("result_snapshots")
      .select("id, generated_at, meetings(title)")
      .order("generated_at", { ascending: false })
      .limit(500),
    supabase
      .from("approval_requests")
      .select("id, status, rooms(room_number), profiles!approval_requests_profile_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  for (const response of [profiles, proxies, meetings, snapshots, approvals]) {
    if (response.error) {
      throw response.error;
    }
  }

  const people: DocumentPickerOption[] = (profiles.data ?? []).map((profile) => {
    const rooms = (profile.owners ?? [])
      .flatMap((owner) => owner.room_owners ?? [])
      .filter((link) => link.status !== "cancelled")
      .map((link) => one(link.rooms)?.room_number)
      .filter((room): room is string => Boolean(room));

    return {
      value: profile.id,
      label: profile.full_name ?? profile.email,
      hint: [...new Set(rooms)].join(", ") || (profile.full_name ? profile.email : undefined),
      keywords: [profile.email, ...rooms].join(" "),
    };
  });
  const proxyOptions: DocumentPickerOption[] = (proxies.data ?? []).map((proxy) => {
    const room = one(proxy.rooms)?.room_number ?? "-";
    const meeting = one(proxy.meetings)?.title ?? "";

    return {
      value: proxy.id,
      label: `${room} · ${one(proxy.owners)?.full_name ?? "-"}`,
      hint: meeting || undefined,
      keywords: meeting,
    };
  });
  const meetingOptions: DocumentPickerOption[] = (meetings.data ?? []).map((meeting) => ({
    value: meeting.id,
    label: meeting.title,
    keywords: [meeting.meeting_number, meeting.fiscal_year].filter(Boolean).join(" ") || undefined,
  }));
  const resultOptions: DocumentPickerOption[] = (snapshots.data ?? []).map((snapshot) => ({
    value: snapshot.id,
    label: one(snapshot.meetings)?.title ?? "-",
    // The generation time tells two results of one meeting apart; the form formats it.
    hint: snapshot.generated_at,
  }));
  const approvalOptions: DocumentPickerOption[] = (approvals.data ?? []).map((approval) => {
    const person = one(approval.profiles);

    return {
      value: approval.id,
      label: person?.full_name ?? person?.email ?? "-",
      hint: one(approval.rooms)?.room_number ?? undefined,
      keywords: person?.email ?? undefined,
    };
  });

  return {
    profile: people,
    proxy_authorization: proxyOptions,
    meeting: meetingOptions,
    result_snapshot: resultOptions,
    approval_request: approvalOptions,
  };
}

export type DocumentOwnerChoices = Awaited<ReturnType<typeof fetchDocumentOwnerChoices>>;
