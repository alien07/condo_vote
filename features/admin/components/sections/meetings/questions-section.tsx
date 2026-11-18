import { EnglishNextStep } from "@/features/english/english-next-step";
import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { ListChecks } from "lucide-react";
import {
  createMeetingChoice,
  deleteMeetingChoice,
  deleteMeetingQuestion,
  updateMeetingChoice,
} from "@/features/admin/actions";
import { AgendaMeetingPicker } from "@/features/admin/components/sections/meetings/agenda-meeting-picker";
import { ConfirmSubmitButton, FormResetButton } from "@/features/admin/components/form-controls";
import { FieldLabel } from "@/features/admin/components/field-label";
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
  const { s } = await getStaffI18n();
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
  const meetingOptions = byNewest.map((item) => ({
    value: item.id,
    label: item.title,
    hint: [codeLabel(s.common.code, item.status), item.meeting_number].filter(Boolean).join(" · "),
  }));
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
        {editable || !meeting ? (
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            href={`${tabHref}&mode=create&type=question`}
          >
            {s.meetings.addQuestion}
          </a>
        ) : null}
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

      {/* Saved: the agenda item's English is on the meeting's English page. */}
      <EnglishNextStep
        always
        meeting={meetings.find(
          (meeting) =>
            meeting.id === questions.find((question) => question.id === focusedQuestionId)?.meeting_id,
        )}
      />
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
                <div className="text-sm text-[var(--muted)]">
                  {fill(s.meetings.agendaLine, {
                    meeting: question.meetings?.title ?? "-",
                    no: question.agenda_no ?? "-",
                    type: question.question_type,
                    resolution: question.resolution_type ?? "-",
                    threshold: question.required_threshold ?? "-",
                  })}
                </div>
                {question.agenda_title ? (
                  <div className="mt-1 text-sm font-medium">
                    {question.agenda_title}
                  </div>
                ) : null}
                <h3 className="mt-1 font-semibold">{question.question_text}</h3>
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
            {editable ? (
            <form
              action={createMeetingChoice}
              className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_160px]"
            >
              <input name="question_id" type="hidden" value={question.id} />
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>{s.meetings.choice}</FieldLabel>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="choice_text"
                  required
                />
              </label>
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={0}
                min={0}
                name="display_order"
                placeholder={s.meetings.order}
                type="number"
              />
              <div className="flex flex-wrap gap-2">
                <PendingSubmitButton
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                  pendingLabel={s.meetings.adding}
                  type="submit"
                >
                  {s.meetings.addChoice}
                </PendingSubmitButton>
                <FormResetButton label="Clear form" />
              </div>
            </form>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {question.meeting_choices
                .sort((left, right) => left.display_order - right.display_order)
                .map((choice) =>
                  editable ? (
                    <details
                      className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                      data-choice-id={choice.id}
                      key={choice.id}
                    >
                      <summary className="tap-target cursor-pointer">
                        <span>{choice.choice_text}</span>
                        {choice.is_abstain ? (
                          <span className="ml-1 text-xs text-[var(--muted)]">
                            {s.meetings.defaultRemovable}
                          </span>
                        ) : null}
                        <span className="ml-2 text-xs font-medium text-[var(--primary)]">{s.common.edit}</span>
                      </summary>
                      {/* Edit the text and order in place (2026-11-18). */}
                      <form action={updateMeetingChoice} className="mt-2 grid gap-2 sm:grid-cols-[1fr_96px_auto]">
                        <input name="id" type="hidden" value={choice.id} />
                        <input
                          aria-label={s.meetings.choice}
                          className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          defaultValue={choice.choice_text}
                          maxLength={500}
                          name="choice_text"
                          required
                        />
                        <input
                          aria-label={s.meetings.order}
                          className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          defaultValue={choice.display_order}
                          min={0}
                          name="display_order"
                          type="number"
                        />
                        <PendingSubmitButton
                          className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
                          pendingLabel={s.common.saving}
                          type="submit"
                        >
                          {s.meetings.saveChoice}
                        </PendingSubmitButton>
                      </form>
                      <form action={deleteMeetingChoice} className="mt-2">
                        <input name="id" type="hidden" value={choice.id} />
                        <ConfirmSubmitButton
                          className="min-h-11 font-medium text-red-700"
                          confirmMessage={fill(s.meetings.confirmDeleteChoice, { text: choice.choice_text })}
                          pendingLabel={s.common.deleting}
                          type="submit"
                        >
                          {s.common.delete}
                        </ConfirmSubmitButton>
                      </form>
                    </details>
                  ) : (
                    <span
                      className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                      data-choice-id={choice.id}
                      key={choice.id}
                    >
                      {choice.choice_text}
                    </span>
                  ),
                )}
            </div>
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
