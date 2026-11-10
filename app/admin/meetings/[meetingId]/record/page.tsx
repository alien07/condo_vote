import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import {
  addMeetingIncident,
  deleteMeetingIncident,
  saveMeetingRecord,
} from "@/features/admin/action-modules/meeting-record";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatBangkokDateTime, isoToBangkokLocalInput } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

type MeetingRecordPageProps = {
  params: Promise<{ meetingId: string }>;
};

const inputClass =
  "min-h-11 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-normal";

// Post-meeting details for the official result record (document 1). They are
// copied into the result snapshot when results are generated.
export default async function MeetingRecordPage({ params }: MeetingRecordPageProps) {
  await requireAdmin();
  const { meetingId } = await params;
  const supabase = await createClient();
  const [meetingResult, incidentsResult, snapshotResult] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id, title, status, starts_at, ends_at, advance_starts_at, advance_ends_at, notice_sent_at, meeting_round, identity_method, recording_reference, traffic_log_reference",
      )
      .eq("id", meetingId)
      .maybeSingle(),
    supabase
      .from("meeting_incidents")
      .select("id, started_at, ended_at, description, action_taken")
      .eq("meeting_id", meetingId)
      .order("started_at", { ascending: true }),
    supabase
      .from("result_snapshots")
      .select("id, generated_at")
      .eq("meeting_id", meetingId)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  if (meetingResult.error) {
    throw meetingResult.error;
  }

  const meeting = meetingResult.data;

  if (!meeting) {
    notFound();
  }

  const incidents = incidentsResult.data ?? [];
  const latestSnapshot = snapshotResult.data?.[0] ?? null;

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
          <ClipboardList className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">Meeting record</h1>
            <p className="text-sm text-[var(--muted)]">
              {meeting.title}. These details go into the official result record
              when results are generated.
            </p>
          </div>
        </div>

        {latestSnapshot ? (
          <p className="mb-5 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            Results were generated {formatBangkokDateTime(latestSnapshot.generated_at)}.
            Changes here appear in the record only after results are generated
            again (possible until the committee approves).{" "}
            <Link
              className="font-medium text-[var(--primary)] underline"
              href={`/record/${latestSnapshot.id}`}
            >
              Open the official record
            </Link>
          </p>
        ) : null}

        <section className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Meeting details</h2>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Advance voting</dt>
              <dd>
                {meeting.advance_starts_at
                  ? `${formatBangkokDateTime(meeting.advance_starts_at)} – ${formatBangkokDateTime(meeting.advance_ends_at)}`
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Meeting-day voting</dt>
              <dd>
                {formatBangkokDateTime(meeting.starts_at)} –{" "}
                {formatBangkokDateTime(meeting.ends_at)}
              </dd>
            </div>
          </dl>
          <form action={saveMeetingRecord} className="mt-4 grid gap-4">
            <input name="meeting_id" type="hidden" value={meeting.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Notice sent to owners
                <input
                  className={inputClass}
                  defaultValue={isoToBangkokLocalInput(meeting.notice_sent_at)}
                  name="notice_sent_at"
                  type="datetime-local"
                />
                <span className="text-xs font-normal text-[var(--muted)]">
                  The Condominium Act asks for at least 7 days before the meeting (s.42/3).
                </span>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Meeting round
                <select className={inputClass} defaultValue={meeting.meeting_round} name="meeting_round">
                  <option value="first">First meeting</option>
                  <option value="reconvened">Reconvened meeting (first had no quorum)</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              How attendees proved who they are
              <textarea
                className={inputClass}
                defaultValue={meeting.identity_method ?? ""}
                name="identity_method"
                placeholder="Online: Google sign-in with a profile approved by the admin. Meeting room: ID card check by the juristic office."
                rows={3}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Meeting recording (where it is kept)
                <input
                  className={inputClass}
                  defaultValue={meeting.recording_reference ?? ""}
                  name="recording_reference"
                  placeholder="Private folder link or document set key"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Attendance and traffic logs (where they are kept)
                <input
                  className={inputClass}
                  defaultValue={meeting.traffic_log_reference ?? ""}
                  name="traffic_log_reference"
                  placeholder="Meeting platform export, private folder link"
                />
              </label>
            </div>
            <div>
              <PendingSubmitButton
                className="min-h-11 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                pendingLabel="Saving..."
                type="submit"
              >
                Save meeting record
              </PendingSubmitButton>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Incidents during voting</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Outages or problems, what was decided, and the fallback channel used.
          </p>
          {incidents.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No incidents recorded.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {incidents.map((incident) => (
                <li
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3 text-sm"
                  key={incident.id}
                >
                  <div>
                    <div className="font-medium">
                      {formatBangkokDateTime(incident.started_at)}
                      {incident.ended_at ? ` – ${formatBangkokDateTime(incident.ended_at)}` : " (ongoing)"}
                    </div>
                    <div>{incident.description}</div>
                    {incident.action_taken ? (
                      <div className="text-[var(--muted)]">Action: {incident.action_taken}</div>
                    ) : null}
                  </div>
                  <form action={deleteMeetingIncident}>
                    <input name="meeting_id" type="hidden" value={meeting.id} />
                    <input name="id" type="hidden" value={incident.id} />
                    <ConfirmSubmitButton
                      className="min-h-11 rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                      confirmMessage="Remove this incident from the meeting record?"
                      pendingLabel="Removing..."
                      type="submit"
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addMeetingIncident} className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
            <input name="meeting_id" type="hidden" value={meeting.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Started
                <input className={inputClass} name="started_at" required type="datetime-local" />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Ended (optional)
                <input className={inputClass} name="ended_at" type="datetime-local" />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              What happened
              <input className={inputClass} name="description" required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Action taken (optional)
              <input
                className={inputClass}
                name="action_taken"
                placeholder="For example: switched to paper ballots, imported as manual votes"
              />
            </label>
            <div>
              <PendingSubmitButton
                className="min-h-11 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                pendingLabel="Adding..."
                type="submit"
              >
                Add incident
              </PendingSubmitButton>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
