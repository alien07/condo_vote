import { ChevronDown } from "lucide-react";
import { archiveMeeting, generateResultSnapshot } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { meetingDrawerHref } from "@/features/admin/components/sections/meetings/meeting-hrefs";
import {
  PublishMeetingForm,
  readinessReason,
} from "@/features/admin/components/sections/meetings/publish-meeting-form";
import type { MeetingReadiness } from "@/features/admin/meeting-readiness";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

type RowMeeting = {
  english_checked_at?: string | null;
  ends_at: string;
  id: string;
  starts_at: string;
  status: string;
  title: string;
  title_en?: string | null;
};

const buttonClass =
  "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]";
const primaryClass =
  "inline-flex min-h-10 items-center rounded-md bg-[var(--primary)] px-3 py-1 text-sm font-medium text-[var(--primary-foreground)]";
const badgeClass =
  "inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--muted)]";
const menuItemClass =
  "flex min-h-11 w-full items-center px-3 py-2 text-left text-sm font-medium hover:bg-[var(--background)]";

/**
 * A meeting's actions (2026-11-18 review): the next step for its status is
 * a button, everything else is under "More".
 */
export async function MeetingRowActions({
  agendaCount,
  bilingual,
  listHref,
  meeting,
  pendingManualCount,
  readiness,
  resultLocked,
  votingOpen,
}: {
  agendaCount: number;
  bilingual: boolean;
  listHref: string;
  meeting: RowMeeting;
  pendingManualCount: number;
  readiness: MeetingReadiness;
  resultLocked: boolean;
  votingOpen: boolean;
}) {
  const { s } = await getStaffI18n();
  const draft = meeting.status === "draft";
  const archived = meeting.status === "archived";
  const englishGap = bilingual && (!meeting.title_en || !meeting.english_checked_at);
  const canGenerate =
    (meeting.status === "published" || meeting.status === "closed") &&
    !resultLocked &&
    (pendingManualCount > 0 || !votingOpen);
  // The record is the next step while voting is open and after approval.
  const recordFirst = !draft && !archived && !canGenerate;

  const agendaLink = (className: string) => (
    <a
      className={className}
      data-agenda-link
      href={`/admin/meetings?tab=questions&meeting=${meeting.id}`}
    >
      {fill(s.meetings.agendaButton, { count: agendaCount })}
    </a>
  );
  const englishLink = (className: string) => (
    <a className={className} href={`/admin/meetings/${meeting.id}/english`}>
      {s.english.openEditor}
      {englishGap ? (
        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          {!meeting.title_en ? s.english.missing : s.english.needsCheck}
        </span>
      ) : null}
    </a>
  );
  const recordLink = (className: string) => (
    <a className={className} href={`/admin/meetings/${meeting.id}/record`}>
      {s.meetings.record}
    </a>
  );

  const menu = [
    draft ? (
      <a className={menuItemClass} href={meetingDrawerHref(listHref, { id: meeting.id, mode: "edit" })} key="edit">
        {s.common.edit}
      </a>
    ) : null,
    !archived && !(draft && !readiness.ready) ? <span key="agenda">{agendaLink(menuItemClass)}</span> : null,
    !archived && !(draft && readiness.ready && englishGap) ? (
      <span key="english">{englishLink(menuItemClass)}</span>
    ) : null,
    !draft && !recordFirst ? <span key="record">{recordLink(menuItemClass)}</span> : null,
    !archived ? (
      <form action={archiveMeeting} key="archive">
        <input name="id" type="hidden" value={meeting.id} />
        <ConfirmSubmitButton
          className={`${menuItemClass} text-red-700`}
          confirmMessage={fill(s.meetings.confirmArchive, { title: meeting.title })}
          pendingLabel={s.meetings.archiving}
          type="submit"
        >
          {s.meetings.archive}
        </ConfirmSubmitButton>
      </form>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-2" data-meeting-actions>
      {/* A draft shows its next step: agenda, then English, then publish. */}
      {draft && !readiness.ready ? agendaLink(primaryClass) : null}
      {draft && readiness.ready && englishGap ? englishLink(primaryClass) : null}
      {draft && readiness.ready && !englishGap ? (
        <PublishMeetingForm
          className={primaryClass}
          count={agendaCount}
          meeting={meeting}
          readiness={readiness}
        />
      ) : null}
      {votingOpen ? <span className={badgeClass}>{s.meetings.votingOpen}</span> : null}
      {resultLocked ? <span className={badgeClass}>{s.meetings.locked}</span> : null}
      {recordFirst ? recordLink(buttonClass) : null}
      {canGenerate ? (
        pendingManualCount > 0 ? (
          <a
            className="inline-flex min-h-10 items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
            href="/admin/voting"
          >
            {fill(s.meetings.resolvePending, { count: pendingManualCount })}
          </a>
        ) : (
          <form action={generateResultSnapshot}>
            <input name="id" type="hidden" value={meeting.id} />
            <PendingSubmitButton className={primaryClass} pendingLabel={s.meetings.generating} type="submit">
              {s.meetings.generate}
            </PendingSubmitButton>
          </form>
        )
      ) : null}
      {archived ? agendaLink(buttonClass) : null}
      {draft && !readiness.ready ? (
        <span className="w-full text-xs text-[var(--muted)]" data-publish-blocked>
          {await readinessReason(readiness)}
        </span>
      ) : null}
      {menu.length ? (
        <details className="group w-full sm:w-auto" data-more-actions>
          <summary className="tap-target inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {s.meetings.moreActions}
            <ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={16} />
          </summary>
          <div className="mt-1 grid min-w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm">
            {menu}
          </div>
        </details>
      ) : null}
    </div>
  );
}
