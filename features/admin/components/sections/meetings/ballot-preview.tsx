import { RequiredMark } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { formatDateTime } from "@/features/admin/components/sections/shared/format";
import { BallotPreviewForm } from "@/features/voting/components/ballot-preview-form";
import { BallotQuestion, type BallotQuestionData } from "@/features/voting/components/ballot-question";
import { localized } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getStaffI18n } from "@/lib/i18n/server";

type PreviewMeeting = {
  ballot_secrecy?: string | null;
  ends_at: string;
  starts_at: string;
  title: string;
  title_en?: string | null;
};

/**
 * Try the ballot as an owner (2026-11-18): the same questions, choices and
 * comment boxes, in the page's language. Answers stay in the browser; the
 * panel closes and widens like the other panels.
 */
export async function BallotPreview({
  closeHref,
  meeting,
  questions,
}: {
  closeHref: string;
  meeting: PreviewMeeting;
  questions: BallotQuestionData[];
}) {
  const { locale, s } = await getStaffI18n();
  const t = getDictionary(locale).vote;
  const [beforeMark, afterMark] = t.requiredNote.split("{mark}");

  return (
    <AdminCrudDrawer
      closeHref={closeHref}
      summary={[s.meetings.previewNote]}
      title={s.meetings.previewTitle}
    >
      <div className="grid gap-4" data-ballot-preview-panel>
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-surface)] px-3 py-2 text-sm text-[var(--warning)]">
          {s.meetings.previewBanner}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{localized(locale, meeting.title, meeting.title_en)}</h3>
          <p className="text-sm text-[var(--muted)]">
            {formatDateTime(meeting.starts_at)} - {formatDateTime(meeting.ends_at)}
          </p>
          {meeting.ballot_secrecy === "secret" ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{t.secretBallot}</p>
          ) : null}
        </div>
        {questions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t.noQuestions}</p>
        ) : (
          <BallotPreviewForm
            doneText={s.meetings.previewDone}
            resetLabel={s.meetings.previewReset}
            submitLabel={t.submit}
          >
            <p className="text-xs text-[var(--muted)]">
              {beforeMark}
              <RequiredMark />
              {afterMark}
            </p>
            {questions.map((question) => (
              <BallotQuestion key={question.id} locale={locale} question={question} />
            ))}
            <p className="text-sm text-[var(--muted)]">{t.canChange}</p>
          </BallotPreviewForm>
        )}
      </div>
    </AdminCrudDrawer>
  );
}
