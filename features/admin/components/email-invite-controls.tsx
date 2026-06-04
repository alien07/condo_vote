"use client";

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
  meetings: {
    id: string;
    title: string;
    status: string;
  }[];
};

const initialState: EmailInviteState = {};

function StatusMessage({ state }: { state: EmailInviteState }) {
  if (state.error) {
    return (
      <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }

  if (state.message) {
    return (
      <p className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.message}
      </p>
    );
  }

  return null;
}

export function EmailInviteControls({ meetings }: EmailInviteControlsProps) {
  const [singleState, singleAction, singlePending] = useActionState(
    resendVoteInvitation,
    initialState,
  );
  const [groupState, groupAction, groupPending] = useActionState(
    queueVoteInvitationGroup,
    initialState,
  );
  const activeMeetings = meetings.filter((meeting) => meeting.status !== "archived");

  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-[var(--border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">Resend To One Recipient</h3>
        </div>
        <form action={singleAction} className="grid gap-3">
          <RequiredNote />
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>Meeting</FieldLabel>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Select meeting</option>
              {activeMeetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} ({meeting.status})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>Recipient email</FieldLabel>
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="email"
              placeholder="recipient@example.com"
              required
              type="email"
            />
          </label>
          <PendingSubmitButton
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            disabled={singlePending}
            pendingLabel="Sending..."
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            Resend vote invitation
          </PendingSubmitButton>
        </form>
        <StatusMessage state={singleState} />
      </section>

      <section className="rounded-md border border-[var(--border)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">Group Resend</h3>
        </div>
        <form action={groupAction} className="grid gap-3">
          <RequiredNote />
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>Meeting</FieldLabel>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Select meeting</option>
              {activeMeetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} ({meeting.status})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <FieldLabel required>Recipient policy</FieldLabel>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue="eligible"
              name="group_mode"
              required
            >
              <option value="eligible">Eligible voters only</option>
              <option value="all_active">
                All active recipients, policy checked
              </option>
            </select>
          </label>
          <PendingSubmitButton
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            disabled={groupPending}
            pendingLabel="Queueing..."
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
            Queue group email
          </PendingSubmitButton>
        </form>
        <StatusMessage state={groupState} />
      </section>
    </div>
  );
}
