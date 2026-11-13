import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchMeetingsData(supabase: SupabaseServerClient) {
  const [meetingsResult, questionsResult] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id, title, description, video_url, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule, required_approvals, ballot_secrecy, advance_starts_at, advance_ends_at, notice_sent_at, meeting_round, identity_method, recording_reference, traffic_log_reference, title_en, english_checked_at",
      )
      .order("starts_at", { ascending: false }),
    supabase
      .from("meeting_questions")
      .select(
        "id, meeting_id, agenda_no, agenda_title, question_text, question_type, max_choices, resolution_type, required_threshold, pass_basis, pass_operator, pass_percent, requires_land_office_registration, legal_note, display_order, required, meetings(id, title), meeting_choices(id, choice_text, display_order, is_abstain)",
      )
      .order("display_order", { ascending: true }),
  ]);

  if (meetingsResult.error) {
    throw meetingsResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  return {
    meetings: meetingsResult.data,
    questions: questionsResult.data,
  };
}
