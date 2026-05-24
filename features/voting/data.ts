import { requireProfile } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function getVotingDashboardData() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: eligibleRows, error: eligibleError } = await supabase
    .from("eligible_voters_snapshot")
    .select(
      "id, meeting_id, room_id, voter_type, ownership_percent, source, meetings(id, title, description, starts_at, ends_at, status, meeting_number, meeting_type), rooms(id, room_number, ownership_percent)",
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (eligibleError) {
    throw eligibleError;
  }

  const meetingIds = [...new Set(eligibleRows.map((row) => row.meeting_id))];

  if (meetingIds.length === 0) {
    return {
      profile,
      eligibleRows,
      questionsByMeeting: new Map<string, never[]>(),
      ballotsByMeetingRoom: new Map<string, never>(),
    };
  }

  const [questionsResult, ballotsResult] = await Promise.all([
    supabase
      .from("meeting_questions")
      .select(
        "id, meeting_id, agenda_no, agenda_title, question_text, question_type, display_order, required, meeting_choices(id, choice_text, display_order)",
      )
      .in("meeting_id", meetingIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("ballots")
      .select(
        "id, meeting_id, room_id, status, submitted_at, version_number, ballot_answers(id, question_id, choice_id)",
      )
      .in("meeting_id", meetingIds),
  ]);

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (ballotsResult.error) {
    throw ballotsResult.error;
  }

  const questionsByMeeting = new Map<
    string,
    typeof questionsResult.data
  >();

  for (const question of questionsResult.data) {
    const questions = questionsByMeeting.get(question.meeting_id) ?? [];
    questions.push(question);
    questionsByMeeting.set(question.meeting_id, questions);
  }

  const ballotsByMeetingRoom = new Map(
    ballotsResult.data.map((ballot) => [
      `${ballot.meeting_id}:${ballot.room_id}`,
      ballot,
    ]),
  );

  return {
    profile,
    eligibleRows,
    questionsByMeeting,
    ballotsByMeetingRoom,
  };
}
