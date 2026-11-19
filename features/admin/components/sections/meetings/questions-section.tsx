import { choiceLabel, choiceTextsLabel } from "@/lib/i18n/choice";
import { getStaffI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { ListChecks } from "lucide-react";
import {
  createMeetingChoice,
  deleteMeetingChoice,
  deleteMeetingQuestion,
  updateMeetingChoice,
} from "@/features/admin/actions";
import { meetingSearchOptions } from "@/features/ui/search-options";
import { AgendaMeetingPicker } from "@/features/admin/components/sections/meetings/agenda-meeting-picker";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { BallotPreview } from "@/features/admin/components/sections/meetings/ballot-preview";
import { MeetingSteps } from "@/features/admin/components/sections/meetings/meeting-steps";
import { meetingReadiness } from "@/features/admin/meeting-readiness";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { QuestionCrudDrawer, QuestionRowFocus } from "@/features/admin/components/question-crud-drawer";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
} from "@/features/admin/components/sections/types";

type QuestionsSectionProps = Pick<AdminDashboardData, "meetings" | "questions"> &
  Pick<AdminWorkspaceProps, "agendaMeetingId" | "drawer" | "focusedQuestionId"> & {
  hidden: boolean;
};

export async function QuestionsSection({
  agendaMeetingId,
  drawer,
  focusedQuestionId,
  meetings,
  questions: allQuestions,
  hidden,
}: QuestionsSectionProps) {
  const { locale, s } = await getStaffI18n();
  const selectedQuestion = allQuestions.find((question) => question.id === drawer?.id);
  // One meeting's agenda at a time (2026-11-18): the meeting in the URL,
  // else the meeting of the item just saved or being edited, else the
  // newest draft, else the newest meeting.
  const openMeetings = meetings.filter((meeting) => meeting.status !== "archived");
  const byNewest = [...openMeetings].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  const meetingId =
    (agendaMeetingId && meetings.some((meeting) => meeting.id === agendaMeetingId) ? agendaMeetingId : undefined) ??
    allQuestions.find((question) => question.id === (focusedQuestionId ?? drawer?.id))?.meeting_id ??
    byNewest.find((meeting) => meeting.status === "draft")?.id ??
    byNewest[0]?.id;
  const meeting = meetings.find((item) => item.id === meetingId);
  const editable = meeting?.status === "draft";
  const questions = allQuestions
    .filter((question) => question.meeting_id === meetingId)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const tabHref = `/admin/meetings?tab=questions${meetingId ? `&meeting=${meetingId}` : ""}`;
  const supabase = await createClient();
  // Voter comments without room or name (0040).
  const { data: comments } = meetingId
    ? await supabase.rpc("meeting_comments", { p_meeting_id: meetingId })
    : { data: [] };
  // Setup steps for a draft (2026-11-18 review).
  const { data: condoSettings } = editable
    ? await supabase
        .from("condo_profiles")
        .select("bilingual_documents")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const readiness = meetingReadiness(questions);
  // The agenda line in words, not codes (2026-11-18 review).
  const thresholdLabels: Record<string, string> = {
    majority_submitted: s.meetings.ruleVotingMajority,
    half_total: s.meetings.ruleTotalMajority,
    one_third_total: s.meetings.ruleThird,
    three_fourths_total: s.meetings.ruleThreeQuarters,
    informational: s.meetings.ruleInfo,
  };
  const resolutionLabels: Record<string, string> = {
    ordinary: s.meetings.ordinary,
    special: s.meetings.special,
    informational: s.meetings.informational,
  };
  const ruleText = (question: (typeof questions)[number]) =>
    question.required_threshold === "custom"
      ? fill(s.meetings.customRuleLine, {
          operator: question.pass_operator === "gte" ? s.meetings.atLeast : s.meetings.moreThan,
          percent: Number(question.pass_percent ?? 0),
          basis: question.pass_basis === "total_ownership" ? s.meetings.basisTotal : s.meetings.basisVoting,
        })
      : codeLabel(thresholdLabels, question.required_threshold);
  const commentsByQuestion = new Map<string, { choice_texts: string[]; comment: string }[]>();
  for (const row of comments ?? []) {
    commentsByQuestion.set(row.question_id, [...(commentsByQuestion.get(row.question_id) ?? []), row]);
  }
  const meetingOptions = meetingSearchOptions(byNewest, (item) =>
    [codeLabel(s.common.code, item.status), item.meeting_number].filter(Boolean).join(" · "),
  );
  const showQuestionDrawer =
    drawer?.type === "question" &&
    (drawer.mode === "create" ||
      (drawer.mode === "edit" && Boolean(selectedQuestion)));
  const questionFocusId =
    drawer?.mode === "edit" && drawer.type === "question"
      ? drawer.id
      : focusedQuestionId;

  return (
    <section
      className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.meetings.questionsTitle}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.meetings.questionsIntro}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Try the ballot as an owner, nothing saved (2026-11-18). */}
          {meeting && questions.length ? (
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
              data-preview-link
              href={`${tabHref}&mode=preview&type=ballot`}
            >
              {s.meetings.previewButton}
            </a>
          ) : null}
          {editable || !meeting ? (
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href={`${tabHref}&mode=create&type=question`}
            >
              {s.meetings.addQuestion}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <AgendaMeetingPicker options={meetingOptions} value={meetingId ?? ""} />
        {meeting ? (
          <p className="text-sm text-[var(--muted)]" data-agenda-meeting>
            {fill(s.meetings.agendaMeetingLine, {
              status: codeLabel(s.common.code, meeting.status),
              count: questions.length,
            })}
          </p>
        ) : null}
        {meeting && !editable ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-agenda-locked>
            {s.meetings.agendaLocked}{" "}
            {meeting.status !== "archived" ? (
              <a className="font-medium underline" href={`/admin/meetings/${meeting.id}/english`}>
                {s.english.openEditor}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>

      {meeting && editable ? (
        <MeetingSteps
          bilingual={Boolean(condoSettings?.bilingual_documents)}
          count={questions.length}
          meeting={meeting}
          readiness={readiness}
        />
      ) : null}
      <div className="grid gap-4">
        {questions.map((question) => {
          const focused = questionFocusId === question.id;

          return (
            <div
              className={[
                "rounded-md border border-[var(--border)] p-4",
                focused
                  ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                  : "",
              ].join(" ")}
              data-question-id={question.id}
              key={question.id}
              tabIndex={-1}
            >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]" data-agenda-line>
                  {[
                    question.agenda_no ? fill(s.meetings.agendaLine, { no: question.agenda_no }) : null,
                    question.question_type === "multiple_choice" ? s.meetings.multiple : s.meetings.single,
                    codeLabel(resolutionLabels, question.resolution_type),
                    ruleText(question),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {question.agenda_title ? (
                  <div className="mt-1 text-sm font-medium">
                    {question.agenda_title}
                  </div>
                ) : null}
                <h3 className="mt-1 font-semibold">{question.question_text}</h3>
                {question.allow_comment ? (
                  <span className="mt-1 inline-block rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                    {s.meetings.commentsBadge}
                  </span>
                ) : null}
                {question.requires_land_office_registration ? (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {s.meetings.landOffice}
                  </div>
                ) : null}
              </div>
              {editable ? (
              <div className="flex flex-wrap gap-2">
                <a
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                  href={`${tabHref}&mode=edit&type=question&id=${question.id}`}
                >
                  {s.common.edit}
                </a>
                <form action={deleteMeetingQuestion}>
                  <input name="id" type="hidden" value={question.id} />
                  <ConfirmSubmitButton
                    className="rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                    confirmMessage={fill(s.meetings.confirmDeleteQuestion, { text: question.question_text })}
                    pendingLabel={s.common.deleting}
                    type="submit"
                  >
                    {s.meetings.deleteQuestion}
                  </ConfirmSubmitButton>
                </form>
              </div>
              ) : null}
            </div>
            {/* Choices as a numbered list, edited in place; a new choice goes
                last (2026-11-18 review). */}
            <div className="mt-4 rounded-md bg-[var(--background)] p-3">
              <h4 className="mb-2 text-sm font-medium">
                {fill(s.meetings.choicesOf, { count: question.meeting_choices.length })}
              </h4>
              <ol className="grid gap-1 text-sm" data-choice-list>
                {[...question.meeting_choices]
                  .sort((left, right) => left.display_order - right.display_order)
                  .map((choice, index) => {
                    const label = choiceLabel(choice.choice_text, choice.is_abstain, locale);

                    return (
                      <li
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)]"
                        data-choice-id={choice.id}
                        key={choice.id}
                      >
                        {editable && !choice.is_abstain ? (
                          <details className="group">
                            <summary className="tap-target flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                              <span className="w-5 shrink-0 text-right text-[var(--muted)]">{index + 1}.</span>
                              <span className="flex-1 [overflow-wrap:anywhere]">{label}</span>
                              <span className="text-xs font-medium text-[var(--primary)] group-open:hidden">{s.common.edit}</span>
                            </summary>
                            <div className="grid gap-2 border-t border-[var(--border)] p-3">
                              <form action={updateMeetingChoice} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-end">
                                <input name="id" type="hidden" value={choice.id} />
                                <label className="grid min-w-0 gap-1 text-xs font-medium">
                                  {s.meetings.choice}
                                  <input
                                    className="min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
                                    defaultValue={choice.choice_text}
                                    maxLength={500}
                                    name="choice_text"
                                    required
                                  />
                                </label>
                                <label className="grid min-w-0 gap-1 text-xs font-medium">
                                  {s.meetings.order}
                                  <input
                                    className="min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal"
                                    // Order starts at 1 (2026-11-18).
                                    defaultValue={Math.max(1, choice.display_order)}
                                    min={1}
                                    name="display_order"
                                    type="number"
                                  />
                                </label>
                                <PendingSubmitButton
                                  className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
                                  pendingLabel={s.common.saving}
                                  type="submit"
                                >
                                  {s.meetings.saveChoice}
                                </PendingSubmitButton>
                              </form>
                              <form action={deleteMeetingChoice}>
                                <input name="id" type="hidden" value={choice.id} />
                                <ConfirmSubmitButton
                                  className="min-h-11 text-sm font-medium text-red-700"
                                  confirmMessage={fill(s.meetings.confirmDeleteChoice, { text: label })}
                                  pendingLabel={s.common.deleting}
                                  type="submit"
                                >
                                  {s.common.delete}
                                </ConfirmSubmitButton>
                              </form>
                            </div>
                          </details>
                        ) : (
                          <div className="flex min-h-11 items-center gap-2 px-3 py-2" data-abstain-row={choice.is_abstain || undefined}>
                            <span className="w-5 shrink-0 text-right text-[var(--muted)]">{index + 1}.</span>
                            <span className="flex-1 [overflow-wrap:anywhere]">{label}</span>
                            {/* Abstain is fixed; it is turned on or off on the agenda item (0041). */}
                            {choice.is_abstain ? (
                              <span className="text-xs text-[var(--muted)]">{s.meetings.abstainFixed}</span>
                            ) : null}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ol>
              {editable ? (
                <form action={createMeetingChoice} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input name="question_id" type="hidden" value={question.id} />
                  <label className="grid flex-1 gap-1 text-xs font-medium">
                    {s.meetings.newChoice}
                    <input
                      className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal"
                      maxLength={500}
                      name="choice_text"
                      placeholder={s.meetings.newChoicePlaceholder}
                      required
                    />
                  </label>
                  <PendingSubmitButton
                    className="min-h-11 rounded-md border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
                    pendingLabel={s.meetings.adding}
                    type="submit"
                  >
                    {s.meetings.addChoice}
                  </PendingSubmitButton>
                </form>
              ) : null}
            </div>
            {question.allow_comment ? (
              <details className="mt-3 text-sm" data-voter-comments>
                <summary className="tap-target inline-flex min-h-11 cursor-pointer items-center font-medium text-[var(--primary)]">
                  {fill(s.meetings.voterComments, { count: commentsByQuestion.get(question.id)?.length ?? 0 })}
                </summary>
                {commentsByQuestion.get(question.id)?.length ? (
                  <ul className="mt-1 grid gap-2">
                    {commentsByQuestion.get(question.id)?.map((row, index) => (
                      <li
                        className="whitespace-pre-line rounded-md bg-[var(--background)] px-3 py-2 [overflow-wrap:anywhere]"
                        key={index}
                      >
                        {row.choice_texts.length ? (
                          <span className="mr-2 text-xs font-medium text-[var(--muted)]">[{choiceTextsLabel(row.choice_texts, locale)}]</span>
                        ) : null}
                        {row.comment}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[var(--muted)]">{s.meetings.noVoterComments}</p>
                )}
              </details>
            ) : null}
            </div>
          );
        })}
      </div>
      <QuestionRowFocus questionId={questionFocusId} />
      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {s.meetings.noQuestions}
        </p>
      ) : null}
      {drawer?.type === "ballot" && drawer.mode === "preview" && meeting ? (
        <BallotPreview closeHref={tabHref} meeting={meeting} questions={questions} />
      ) : null}
      {showQuestionDrawer ? (
        <QuestionCrudDrawer
          closeHref={tabHref}
          defaultMeetingId={meetingId}
          meetings={meetings}
          mode={drawer?.mode === "edit" ? "edit" : "create"}
          question={selectedQuestion}
        />
      ) : null}
    </section>
  );
}
