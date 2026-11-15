import { bangkokDateTimeParts } from "@/lib/datetime";
import type { VoteSourceConflictActionState } from "@/features/admin/actions";

export type ConflictAnswer = {
  choiceId: string;
  choiceText: string;
  questionId: string;
  questionText: string;
};

export type VoteConflictRow = {
  key: string;
  manualAnswers: ConflictAnswer[];
  manualBallotId: string;
  manualIdentityStatus: string;
  manualImportedAt: string;
  manualSourceLabel: string | null;
  manualVoterIdentityText: string | null;
  manualVoterProfileId: string | null;
  meetingId: string;
  meetingTitle: string;
  onlineAnswers: ConflictAnswer[];
  onlineAnswersHidden: boolean;
  onlineBallotId: string;
  onlineSubmittedAt: string;
  resolution: {
    chosen_source: string;
    conflict_remark: string | null;
    resolved_at: string;
  } | null;
  roomId: string;
  roomNumber: string;
  status: "resolved" | "unresolved";
};

export type ConflictFilters = {
  dir: "asc" | "desc";
  meeting: string;
  page: number;
  perPage: number;
  room: string;
  sort: "meeting" | "resolved_at" | "room" | "status";
  status: string;
};

export type ConflictApiResponse = {
  conflictPage: number;
  conflictPerPage: number;
  conflictTotal: number;
  conflicts: VoteConflictRow[];
};

export type VoteConflictsTableProps = {
  initialFilters: ConflictFilters;
  initialPage: number;
  initialPerPage: number;
  initialRows: VoteConflictRow[];
  initialTotal: number;
};

export function buildParams(filters: ConflictFilters) {
  const params = new URLSearchParams();

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return params;
}

export function syncUrl(filters: ConflictFilters) {
  const params = buildParams(filters);
  const query = params.toString();

  window.history.replaceState(
    null,
    "",
    query ? `/admin/voting/conflicts?${query}` : "/admin/voting/conflicts",
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const { date, time } = bangkokDateTimeParts(value);

  return `${date} ${time}`;
}

export function escapeSelectorValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
}

// A question can have several answers (multiple choice, D017).
export function answerByQuestion(answers: ConflictAnswer[]) {
  const grouped = new Map<
    string,
    { choiceIds: string[]; choiceText: string; questionText: string }
  >();

  for (const answer of answers) {
    const current = grouped.get(answer.questionId);

    grouped.set(answer.questionId, {
      choiceIds: [...(current?.choiceIds ?? []), answer.choiceId].sort(),
      choiceText: current
        ? `${current.choiceText}, ${answer.choiceText}`
        : answer.choiceText,
      questionText: answer.questionText,
    });
  }

  return grouped;
}

export function conflictQuestionRows(conflict: VoteConflictRow) {
  const onlineByQuestion = answerByQuestion(conflict.onlineAnswers);
  const manualByQuestion = answerByQuestion(conflict.manualAnswers);
  const questionIds = [
    ...new Set([
      ...conflict.manualAnswers.map((answer) => answer.questionId),
      ...conflict.onlineAnswers.map((answer) => answer.questionId),
    ]),
  ];

  return questionIds.map((questionId) => {
    const manual = manualByQuestion.get(questionId);
    const online = onlineByQuestion.get(questionId);

    return {
      differs:
        !conflict.onlineAnswersHidden &&
        (manual?.choiceIds.join(",") ?? "") !== (online?.choiceIds.join(",") ?? ""),
      manual,
      online,
      questionId,
      questionText: manual?.questionText ?? online?.questionText ?? "-",
    };
  });
}

export const emptyConflictState: VoteSourceConflictActionState = {};
