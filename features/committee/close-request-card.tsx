import { CountedText } from "@/features/committee/counted-text";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import { ApproverList } from "@/features/committee/approver-list";
import { CloseDetailsButton } from "@/features/committee/close-details-button";
import { CloseWhenFields } from "@/features/committee/close-when-fields";
import {
  answerCloseAsCommittee,
  cancelCloseAsCommittee,
  proposeCloseAsCommittee,
} from "@/features/committee/actions";
import type { CommitteeOverview } from "@/features/results/committee-service";
import { Term } from "@/features/glossary/term";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { localized } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/locales";
import { fill } from "@/lib/i18n/template";

type Meeting = CommitteeOverview["open_meetings"][number];

const input =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal";
const secondaryButton =
  "min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium";

/** One open meeting: its close-early request, or a way to propose one
 * (demo feedback item 10). */
export function CloseRequestCard({
  meeting,
  members,
  isMember,
  locale,
  formatDateTime,
  t,
}: {
  meeting: Meeting;
  members: CommitteeOverview["members"];
  isMember: boolean;
  locale: Locale;
  formatDateTime: (value: string) => string;
  t: StaffDictionary["committee"];
}) {
  const request = meeting.request;
  // English title when the reader uses English and it was written (D020).
  const title = localized(locale, meeting.title, meeting.title_en);
  const approvals = request?.answers.filter((answer) => answer.answer === "approve").length ?? 0;
  const objections = request?.answers.filter((answer) => answer.answer === "object").length ?? 0;
  const more = Math.max(meeting.required_approvals - approvals, 0);

  return (
    <div
      className="grid gap-3 rounded-md border border-[var(--border)] p-4"
      data-meeting-id={meeting.id}
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-[var(--muted)]">
          {fill(t.closesAuto, { time: formatDateTime(meeting.ends_at) })}
        </div>
        {meeting.closes_early_at ? (
          <div className="text-sm font-medium">
            {fill(t.closesEarlyAt, { time: formatDateTime(meeting.closes_early_at) })}
          </div>
        ) : null}
      </div>

      {request ? (
        <div className="grid gap-2 rounded-md bg-[var(--background)] p-3 text-sm" data-close-request>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.requestStatus.open}</span>
            {request.my_answer === "approve" ? (
              <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                {t.youApproved}
              </span>
            ) : null}
          </div>
          <div>{fill(t.requestBy, { name: request.proposer ?? "-", time: formatDateTime(request.created_at) })}</div>
          <div>{fill(t.requestReason, { reason: request.reason })}</div>
          <div className="text-[var(--muted)]">
            {request.close_at
              ? fill(t.requestCloseAt, {
                  time: formatDateTime(request.close_at),
                  required: meeting.required_approvals,
                })
              : fill(t.requestCloseNow, { required: meeting.required_approvals })}
          </div>
          <div data-close-count>
            <Term
              extra={
                <ApproverList
                  entries={request.answers.map((answer) => ({
                    profileId: answer.profile_id,
                    name: answer.name,
                    kind: answer.answer,
                    at: answer.answered_at,
                    note: answer.reason,
                  }))}
                  formatTime={formatDateTime}
                  members={members}
                  text={t}
                />
              }
              k="approveClose"
              locale={locale}
            >
              {more > 0
                ? fill(t.countMore, { count: approvals, required: meeting.required_approvals, more })
                : fill(t.countDone, { count: approvals, required: meeting.required_approvals })}
              {objections > 0 ? ` · ${t.objected} ${objections}` : null}
            </Term>
          </div>

          {request.proposed_by_me ? (
            // The proposal counts as the proposer's approval; they cancel
            // instead of objecting (review 2026-11-14).
            <p className="text-[var(--muted)]" data-proposer-note>
              {t.proposerNote}
            </p>
          ) : isMember ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {request.my_answer !== "approve" ? (
                <form action={answerCloseAsCommittee}>
                  <input name="request_id" type="hidden" value={request.id} />
                  <input name="answer" type="hidden" value="approve" />
                  <ConfirmSubmitButton
                    className="min-h-11 w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    confirmMessage={fill(t.confirmApproveClose, {
                      title,
                      required: meeting.required_approvals,
                    })}
                    pendingLabel={t.saving}
                    tone="primary"
                  >
                    {t.answerApprove}
                  </ConfirmSubmitButton>
                </form>
              ) : null}
              {request.my_answer !== "object" ? (
                <form action={answerCloseAsCommittee} className="grid gap-2">
                  <input name="request_id" type="hidden" value={request.id} />
                  <input name="answer" type="hidden" value="object" />
                  <label className="grid gap-1 font-medium">
                    <span>
                      {t.objectReason} <RequiredMark />
                    </span>
                    <CountedText className={input} maxLength={500} name="reason" required />
                  </label>
                  <ConfirmSubmitButton
                    className={secondaryButton}
                    confirmMessage={fill(t.confirmObject, { title })}
                    pendingLabel={t.saving}
                  >
                    {t.answerObject}
                  </ConfirmSubmitButton>
                </form>
              ) : null}
              <p className="text-xs text-[var(--muted)] sm:col-span-2">{t.changeAnswer}</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">{t.notMember}</p>
          )}

          {request.proposed_by_me ? (
            <form action={cancelCloseAsCommittee}>
              <input name="request_id" type="hidden" value={request.id} />
              <ConfirmSubmitButton
                className={secondaryButton}
                confirmMessage={t.confirmCancel}
                pendingLabel={t.saving}
              >
                {t.cancelRequest}
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      ) : meeting.closes_early_at ? null : (
        <>
        {meeting.last_request ? (
          // What happened to the last request, in one folded line so many
          // requests over time do not make the card long. Older ones are in
          // the audit log.
          <details className="rounded-md border border-[var(--border)] px-3 py-2 text-sm" data-last-request>
            <summary className="cursor-pointer text-[var(--muted)]">
              {fill(t.lastRequest, { status: t.requestStatus[meeting.last_request.status] ?? meeting.last_request.status })}
              {meeting.last_request.ended_at ? ` · ${formatDateTime(meeting.last_request.ended_at)}` : null}
            </summary>
            <div className="mt-2 grid gap-1">
            <div className="text-[var(--muted)]">
              {fill(t.lastRequestBy, { name: meeting.last_request.proposer ?? "-" })}
            </div>
            <div>{fill(t.requestReason, { reason: meeting.last_request.reason })}</div>
            {meeting.last_request.answers.map((answer, index) => (
              <div className="text-[var(--muted)]" key={index}>
                {fill(t.lastRequestAnswer, {
                  name: answer.name ?? "-",
                  answer: answer.answer === "object" ? t.objected : t.answerApprove,
                })}
                {answer.reason ? ` · ${answer.reason}` : null}
              </div>
            ))}
            </div>
          </details>
        ) : null}
        <details className="text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[var(--border)] px-3 py-2 font-medium">
            {t.propose}
          </summary>
          <form action={proposeCloseAsCommittee} className="mt-3 grid gap-3 sm:max-w-md">
            <input name="meeting_id" type="hidden" value={meeting.id} />
            <label className="grid gap-1 font-medium">
              <span>
                {t.proposeReason} <RequiredMark />
              </span>
              <CountedText className={input} maxLength={500} multiline name="reason" required />
            </label>
            <CloseWhenFields
              endsAt={meeting.ends_at}
              inputClassName={input}
              labels={{
                when: t.proposeWhen,
                now: t.proposeNow,
                at: t.proposeAt,
                atTime: t.proposeAtTime,
                atHint: fill(t.proposeAtHint, { time: formatDateTime(meeting.ends_at) }),
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <CloseDetailsButton
                className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                label={t.cancel}
              />
              <ConfirmSubmitButton
                className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                confirmMessage={fill(t.confirmPropose, { title })}
                pendingLabel={t.proposing}
                tone="primary"
              >
                {t.sendRequest}
              </ConfirmSubmitButton>
            </div>
          </form>
        </details>
        </>
      )}
    </div>
  );
}
