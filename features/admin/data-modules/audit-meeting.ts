import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A PostgREST `or` filter for the audit log rows about one meeting
 * (req_0007): the meeting itself, rows whose details name it (`meeting_id`
 * or `meeting`), and rows about records of that meeting (results,
 * correction and early-close requests, proxies). Records the reader may not
 * see under RLS are simply not listed; most rows also carry `meeting_id` in
 * their details. Returns null for a value that is not an id.
 */
export async function auditMeetingFilter(supabase: SupabaseServerClient, meetingId: string) {
  if (!UUID.test(meetingId)) {
    return null;
  }

  const [snapshots, corrections, closeRequests, proxies] = await Promise.all([
    supabase.from("result_snapshots").select("id").eq("meeting_id", meetingId),
    supabase.from("result_correction_requests").select("id").eq("meeting_id", meetingId),
    supabase.from("meeting_close_requests").select("id").eq("meeting_id", meetingId),
    supabase.from("proxy_authorizations").select("id").eq("meeting_id", meetingId),
  ]);
  const ids = [meetingId];

  for (const result of [snapshots, corrections, closeRequests, proxies]) {
    // A table the reader cannot read under RLS just adds nothing.
    for (const row of result.data ?? []) {
      ids.push(row.id);
    }
  }

  return [
    `entity_id.in.(${ids.join(",")})`,
    `details_json->>meeting_id.eq.${meetingId}`,
    `details_json->>meeting.eq.${meetingId}`,
  ].join(",");
}
