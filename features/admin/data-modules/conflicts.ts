import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type VoteConflictFilters = {
  dir?: "asc" | "desc";
  meeting?: string;
  page?: number;
  perPage?: number;
  room?: string;
  sortBy?: "meeting" | "resolved_at" | "room" | "status";
  status?: string;
};

type VoteAnswer = {
  choice_id: string;
  meeting_choices: { choice_text: string | null } | null;
  meeting_questions: {
    agenda_no: string | null;
    question_text: string | null;
  } | null;
  question_id: string;
};

function normalizeAnswers(answers: VoteAnswer[]) {
  return answers.map((answer) => ({
    choiceId: answer.choice_id,
    choiceText: answer.meeting_choices?.choice_text ?? "-",
    questionId: answer.question_id,
    questionText: [
      answer.meeting_questions?.agenda_no,
      answer.meeting_questions?.question_text,
    ]
      .filter(Boolean)
      .join(". ") || "-",
  }));
}

export async function fetchVoteConflictRows(
  supabase: SupabaseServerClient,
  filters: VoteConflictFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(Math.max(filters.perPage ?? 25, 10), 100);
  const direction = filters.dir === "asc" ? 1 : -1;
  const [manualResult, onlineResult, resolutionResult] = await Promise.all([
    supabase
      .from("manual_ballots")
      .select(
        "id, meeting_id, room_id, source_label, audit_note, identity_status, voter_profile_id, voter_identity_text, status, imported_at, meetings(id, title), rooms(id, room_number), manual_ballot_answers(question_id, choice_id, meeting_questions(agenda_no, question_text), meeting_choices(choice_text))",
      )
      .eq("status", "submitted")
      .neq("identity_status", "pending"),
    supabase
      .from("ballots")
      .select(
        "id, meeting_id, room_id, status, submitted_at, meetings(id, title), rooms(id, room_number), ballot_answers(question_id, choice_id, meeting_questions(agenda_no, question_text), meeting_choices(choice_text))",
      )
      .eq("status", "submitted"),
    supabase
      .from("vote_source_resolutions")
      .select(
        "id, meeting_id, room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at",
      ),
  ]);

  if (manualResult.error) {
    throw manualResult.error;
  }

  if (onlineResult.error) {
    throw onlineResult.error;
  }

  if (resolutionResult.error) {
    throw resolutionResult.error;
  }

  const onlineByRoomKey = new Map(
    onlineResult.data.map((ballot) => [
      `${ballot.meeting_id}:${ballot.room_id}`,
      ballot,
    ]),
  );
  const resolutionByRoomKey = new Map(
    resolutionResult.data.map((resolution) => [
      `${resolution.meeting_id}:${resolution.room_id}`,
      resolution,
    ]),
  );
  const allRows = manualResult.data
    .map((manualBallot) => {
      const key = `${manualBallot.meeting_id}:${manualBallot.room_id}`;
      const onlineBallot = onlineByRoomKey.get(key);

      if (!onlineBallot) {
        return null;
      }

      const resolution = resolutionByRoomKey.get(key) ?? null;

      return {
        key,
        manualAnswers: normalizeAnswers(
          manualBallot.manual_ballot_answers as VoteAnswer[],
        ),
        manualBallotId: manualBallot.id,
        manualIdentityStatus: manualBallot.identity_status,
        manualImportedAt: manualBallot.imported_at,
        manualSourceLabel: manualBallot.source_label,
        manualVoterIdentityText: manualBallot.voter_identity_text,
        manualVoterProfileId: manualBallot.voter_profile_id,
        meetingId: manualBallot.meeting_id,
        meetingTitle: manualBallot.meetings?.title ?? "-",
        onlineAnswers: normalizeAnswers(
          onlineBallot.ballot_answers as VoteAnswer[],
        ),
        onlineBallotId: onlineBallot.id,
        onlineSubmittedAt: onlineBallot.submitted_at,
        resolution,
        roomId: manualBallot.room_id,
        roomNumber: manualBallot.rooms?.room_number ?? "-",
        status: resolution ? "resolved" : "unresolved",
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const meetingQuery = filters.meeting?.trim().toLowerCase() ?? "";
  const roomQuery = filters.room?.trim().toLowerCase() ?? "";
  const filteredRows = allRows.filter((row) => {
    const matchesMeeting = meetingQuery
      ? row.meetingTitle.toLowerCase().includes(meetingQuery)
      : true;
    const matchesRoom = roomQuery
      ? row.roomNumber.toLowerCase().includes(roomQuery)
      : true;
    const matchesStatus =
      filters.status && filters.status !== "all"
        ? row.status === filters.status
        : true;

    return matchesMeeting && matchesRoom && matchesStatus;
  });
  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftValue =
      filters.sortBy === "room"
        ? left.roomNumber
        : filters.sortBy === "status"
          ? left.status
          : filters.sortBy === "resolved_at"
            ? left.resolution?.resolved_at ?? ""
            : left.meetingTitle;
    const rightValue =
      filters.sortBy === "room"
        ? right.roomNumber
        : filters.sortBy === "status"
          ? right.status
          : filters.sortBy === "resolved_at"
            ? right.resolution?.resolved_at ?? ""
            : right.meetingTitle;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const total = sortedRows.length;
  const pageStart = (page - 1) * perPage;
  const rows = sortedRows.slice(pageStart, pageStart + perPage);

  return {
    conflictPage: page,
    conflictPerPage: perPage,
    conflictTotal: total,
    conflicts: rows,
  };
}
