import { publishMeeting } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { formatDateTime } from "@/features/admin/components/sections/shared/format";
import type { MeetingReadiness } from "@/features/admin/meeting-readiness";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

type PublishMeeting = { id: string; title: string; starts_at: string; ends_at: string };

/** Why a draft cannot be published yet, in the viewer's words. */
export async function readinessReason(readiness: MeetingReadiness) {
  const { s } = await getStaffI18n();

  return readiness.noAgenda
    ? s.meetings.stepNoAgenda
    : fill(s.meetings.stepMissingChoices, { items: readiness.withoutChoices.join(", ") });
}

/**
 * Publish, after a confirm that sums up the meeting (2026-11-18 review):
 * publishing locks the agenda (0039). Not ready: no button, the reason
 * instead. publishMeeting checks again on the server.
 */
export async function PublishMeetingForm({
  className,
  count,
  meeting,
  readiness,
}: {
  className: string;
  count: number;
  meeting: PublishMeeting;
  readiness: MeetingReadiness;
}) {
  const { s } = await getStaffI18n();

  if (!readiness.ready) {
    return (
      <span className="text-xs text-[var(--warning)]" data-publish-blocked>
        {fill(s.meetings.publishNotReady, { reason: await readinessReason(readiness) })}
      </span>
    );
  }

  return (
    <form action={publishMeeting}>
      <input name="id" type="hidden" value={meeting.id} />
      <ConfirmSubmitButton
        className={className}
        confirmMessage={fill(s.meetings.publishConfirm, {
          title: meeting.title,
          count,
          window: `${formatDateTime(meeting.starts_at)} - ${formatDateTime(meeting.ends_at)}`,
        })}
        confirmTitle={s.meetings.publishTitle}
        pendingLabel={s.meetings.publishing}
        tone="primary"
        type="submit"
      >
        {s.meetings.publish}
      </ConfirmSubmitButton>
    </form>
  );
}
