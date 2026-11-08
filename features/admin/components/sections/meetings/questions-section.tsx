import { ListChecks } from "lucide-react";
import { createMeetingChoice, deleteMeetingChoice, deleteMeetingQuestion } from "@/features/admin/actions";
import { ConfirmSubmitButton, FormResetButton } from "@/features/admin/components/form-controls";
import { FieldLabel } from "@/features/admin/components/field-label";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { QuestionCrudDrawer, QuestionRowFocus } from "@/features/admin/components/question-crud-drawer";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
} from "@/features/admin/components/sections/types";

type QuestionsSectionProps = Pick<AdminDashboardData, "meetings" | "questions"> &
  Pick<AdminWorkspaceProps, "drawer" | "focusedQuestionId"> & {
  hidden: boolean;
};

export function QuestionsSection({
  drawer,
  focusedQuestionId,
  meetings,
  questions,
  hidden,
}: QuestionsSectionProps) {
  const selectedQuestion = questions.find((question) => question.id === drawer?.id);
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
            <h2 className="text-lg font-semibold">Questions And Choices</h2>
            <p className="text-sm text-[var(--muted)]">
              Add agenda questions, then manage choices on each question row.
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href="/admin/meetings?tab=questions&mode=create&type=question"
        >
          Add question
        </a>
      </div>

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
                  {question.meetings?.title ?? "-"} / agenda{" "}
                  {question.agenda_no ?? "-"} / {question.question_type} /{" "}
                  {question.resolution_type} / {question.required_threshold}
                </div>
                {question.agenda_title ? (
                  <div className="mt-1 text-sm font-medium">
                    {question.agenda_title}
                  </div>
                ) : null}
                <h3 className="mt-1 font-semibold">{question.question_text}</h3>
                {question.requires_land_office_registration ? (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Requires land office registration
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                  href={`/admin/meetings?tab=questions&mode=edit&type=question&id=${question.id}`}
                >
                  Edit
                </a>
                <form action={deleteMeetingQuestion}>
                  <input name="id" type="hidden" value={question.id} />
                  <ConfirmSubmitButton
                    className="rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                    confirmMessage={`Delete question "${question.question_text}"? This removes the agenda question and its configured choices from the meeting setup.`}
                    pendingLabel="Deleting..."
                    type="submit"
                  >
                    Delete question
                  </ConfirmSubmitButton>
                </form>
              </div>
            </div>
            <form
              action={createMeetingChoice}
              className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_160px]"
            >
              <input name="question_id" type="hidden" value={question.id} />
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Choice</FieldLabel>
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
                placeholder="Order"
                type="number"
              />
              <div className="flex flex-wrap gap-2">
                <PendingSubmitButton
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                  pendingLabel="Adding..."
                  type="submit"
                >
                  Add choice
                </PendingSubmitButton>
                <FormResetButton label="Clear form" />
              </div>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {question.meeting_choices
                .sort((left, right) => left.display_order - right.display_order)
                .map((choice) => (
                  <form
                    action={deleteMeetingChoice}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                    key={choice.id}
                  >
                    <span>
                      {choice.choice_text}
                      {choice.is_abstain ? (
                        <span className="ml-1 text-xs text-[var(--muted)]">
                          (default, removable)
                        </span>
                      ) : null}
                    </span>
                    <input name="id" type="hidden" value={choice.id} />
                    <ConfirmSubmitButton
                      className="font-medium text-red-700"
                      confirmMessage={`Delete choice "${choice.choice_text}"? Existing ballot setup for this choice will no longer be available.`}
                      pendingLabel="Deleting..."
                      type="submit"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                ))}
            </div>
            </div>
          );
        })}
      </div>
      <QuestionRowFocus questionId={questionFocusId} />
      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No meeting questions have been created yet.
        </p>
      ) : null}
      {showQuestionDrawer ? (
        <QuestionCrudDrawer
          closeHref="/admin/meetings?tab=questions"
          meetings={meetings}
          mode={drawer?.mode === "edit" ? "edit" : "create"}
          question={selectedQuestion}
        />
      ) : null}
    </section>
  );
}
