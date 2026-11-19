"use client";

import { useMessageText, useStaffText } from "@/lib/i18n/staff/client";
import { useActionState } from "react";
import { Mail, Send } from "lucide-react";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import {
  queueVoteInvitationGroup,
  resendVoteInvitation,
  type EmailInviteState,
} from "@/features/admin/actions";

type EmailInviteControlsProps = {
  /** Published meetings still open for voting (takesVoteInvitations),
   * labelled with the closing time. */
  meetingOptions: { value: string; label: string }[];
};

const initialState: EmailInviteState = {};

function StatusMessage({ state }: { state: EmailInviteState }) {
  const tm = useMessageText();
  if (state.error) {
    return (
      <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {tm(state.error)}
      </p>
    );
  }

  if (state.message) {
    return (
      <p className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {tm(state.message)}
      </p>
    );
  }

  return null;
}

function MeetingSelect({ meetingOptions }: EmailInviteControlsProps) {
  const { s } = useStaffText();

  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium">
      <FieldLabel required>{s.communications.meeting}</FieldLabel>
      {/* w-full min-w-0: a long meeting name must not widen the form past
          its card (2026-11-19 review). */}
      <select
        className="w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        name="meeting_id"
        required
      >
        <option value="">{s.communications.selectMeeting}</option>
        {meetingOptions.map((meeting) => (
          <option key={meeting.value} value={meeting.value}>
            {meeting.label}
          </option>
        ))}
      </select>
      {meetingOptions.length ? null : (
        <span className="text-sm font-normal text-[var(--warning)]" data-no-invite-meetings>
          {s.communications.noInviteMeetings}
        </span>
      )}
      <span className="text-xs font-normal text-[var(--muted)]">{s.communications.inviteMeetingHelp}</span>
    </label>
  );
}

export function EmailInviteControls({ meetingOptions }: EmailInviteControlsProps) {
  const { s } = useStaffText();
  const [singleState, singleAction, singlePending] = useActionState(
    resendVoteInvitation,
    initialState,
  );
  const [groupState, groupAction, groupPending] = useActionState(
    queueVoteInvitationGroup,
    initialState,
  );

  return (
    <div className="mb-5 grid gap-3">
    <RequiredNote />
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-md border border-[var(--border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">{s.communications.resendOne}</h3>
        </div>
        <form action={singleAction} className="grid gap-3">
          <MeetingSelect meetingOptions={meetingOptions} />
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>{s.communications.recipientEmail}</FieldLabel>
            <input
              className="w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="email"
              placeholder="recipient@example.com"
              required
              type="email"
            />
          </label>
          <PendingSubmitButton
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            disabled={singlePending}
            pendingLabel={s.communications.sending}
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            {s.communications.resend}
          </PendingSubmitButton>
        </form>
        <StatusMessage state={singleState} />
      </section>

      <section className="min-w-0 rounded-md border border-[var(--border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">{s.communications.group}</h3>
        </div>
        <form action={groupAction} className="grid gap-3">
          <MeetingSelect meetingOptions={meetingOptions} />
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>{s.communications.policy}</FieldLabel>
            <select
              className="w-full min-w-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue="eligible"
              name="group_mode"
              required
            >
              <option value="eligible">{s.communications.eligibleOnly}</option>
              <option value="all_active">
                {s.communications.allActive}
              </option>
            </select>
          </label>
          <PendingSubmitButton
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            disabled={groupPending}
            pendingLabel={s.communications.queueing}
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            {s.communications.queueGroup}
          </PendingSubmitButton>
        </form>
        <StatusMessage state={groupState} />
      </section>
    </div>
    </div>
  );
}
