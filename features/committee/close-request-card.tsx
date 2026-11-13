import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { RequiredMark } from "@/features/admin/components/field-label";
import { ApproverList } from "@/features/committee/approver-list";
import {
  answerCloseAsCommittee,
  cancelCloseAsCommittee,
  proposeCloseAsCommittee,
} from "@/features/committee/actions";
import type { CommitteeOverview } from "@/features/results/committee-service";
import { Term } from "@/features/glossary/term";
import type { StaffDictionary } from "@/lib/i18n/staff";
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
  const approvals = request?.answers.filter((answer) => answer.answer === "approve").length ?? 0;
  const objections = request?.answers.filter((answer) => answer.answer === "object").length ?? 0;
  const more = Math.max(meeting.required_approvals - approvals, 0);

  return (
    <div
      className="grid gap-3 rounded-md border border-[var(--border)] p-4"
      data-meeting-id={meeting.id}
    >
      <div>
        <div className="font-medium">{meeting.title}</div>
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

          {isMember ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {request.my_answer !== "approve" ? (
                <form action={answerCloseAsCommittee}>
                  <input name="request_id" type="hidden" value={request.id} />
                  <input name="answer" type="hidden" value="approve" />
                  <ConfirmSubmitButton
                    className="min-h-11 w-full rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    confirmMessage={fill(t.confirmApproveClose, {
                      title: meeting.title,
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
                    <input className={input} name="reason" required />
                  </label>
                  <ConfirmSubmitButton
                    className={secondaryButton}
                    confirmMessage={fill(t.confirmObject, { title: meeting.title })}
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
              <textarea className={input} name="reason" required rows={2} />
            </label>
            <fieldset className="grid gap-2">
              <legend className="font-medium">{t.proposeWhen}</legend>
              <label className="inline-flex items-center gap-2">
                <input defaultChecked name="when" type="radio" value="now" />
                {t.proposeNow}
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="when" type="radio" value="at" />
                {t.proposeAt}
              </label>
              <label className="grid gap-1">
                <span>{t.proposeAtTime}</span>
                <input className={input} name="close_at" type="datetime-local" />
              </label>
            </fieldset>
            <ConfirmSubmitButton
              className="min-h-11 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              confirmMessage={fill(t.confirmPropose, { title: meeting.title })}
              pendingLabel={t.proposing}
              tone="primary"
            >
              {t.sendRequest}
            </ConfirmSubmitButton>
          </form>
        </details>
      )}
    </div>
  );
}
