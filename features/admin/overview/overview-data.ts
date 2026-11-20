import type { createClient } from "@/lib/supabase/server";
import { meetingTurnout, type SpotlightMeetingLike } from "@/features/admin/overview/overview-model";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000;

/** Every row of a query, page by page (PostgREST returns at most 1000). */
async function allRows<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE) {
      return rows;
    }
  }
}

/** Turnout and quorum of one spotlight meeting (req_0008): eligible rooms
 * with their ownership, rooms with a submitted online ballot, rooms with a
 * counted paper ballot. No answers are read. */
export async function fetchMeetingTurnout(supabase: SupabaseServerClient, meeting: SpotlightMeetingLike) {
  const [eligible, online, paper] = await Promise.all([
    allRows((from, to) =>
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", meeting.id)
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("ballots")
        .select("room_id")
        .eq("meeting_id", meeting.id)
        .eq("status", "submitted")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("manual_ballots")
        .select("room_id")
        .eq("meeting_id", meeting.id)
        .eq("status", "submitted")
        .order("id")
        .range(from, to),
    ),
  ]);

  return meetingTurnout({
    eligible,
    onlineRoomIds: online.map((row) => row.room_id),
    paperRoomIds: paper.map((row) => row.room_id),
    quorumRule: meeting.quorum_rule,
  });
}

/** Draft meetings still missing English text or a check, while two-language
 * documents are on (req_0008 item 3); null when they are off. Only drafts:
 * a published meeting is no longer something to finish before publishing. */
export async function fetchEnglishDraftCount(supabase: SupabaseServerClient) {
  const { data: condo, error } = await supabase
    .from("condo_profiles")
    .select("bilingual_documents")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!condo?.bilingual_documents) {
    return null;
  }

  const { count, error: countError } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .or("title_en.is.null,english_checked_at.is.null");

  if (countError) {
    throw countError;
  }

  return count ?? 0;
}
