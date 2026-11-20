import Link from "next/link";
import type { meetingTurnout, SpotlightMeetingLike } from "@/features/admin/overview/overview-model";
import { timeUntil } from "@/features/admin/overview/overview-model";
import { formatDateTimeIn } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { fill } from "@/lib/i18n/template";

type Turnout = ReturnType<typeof meetingTurnout>;

function percentText(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function Bar({ marker, value }: { marker?: number | null; value: number }) {
  return (
    <span aria-hidden="true" className="relative mt-2 block h-2.5 overflow-hidden rounded-full bg-[var(--background)]">
      <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {marker ? (
        <span className="absolute top-0 h-full w-0.5 bg-[var(--foreground)]" style={{ left: `${Math.min(100, marker)}%` }} />
      ) : null}
    </span>
  );
}

/**
 * The meeting happening now, big enough to show on a screen in a meeting
 * (req_0008 item 2): when it opens or closes, turnout so far and whether the
 * quorum is met. Never votes per choice: results appear only after the
 * committee approves them (D015).
 */
export function MeetingSpotlight({
  href,
  locale,
  meeting,
  now,
  s,
  state,
  turnout,
}: {
  /** The meeting in the meetings list; none for roles that cannot open it
   * (office staff see the numbers only, req_0009). */
  href?: string;
  locale: Locale;
  meeting: SpotlightMeetingLike;
  now: Date;
  s: StaffDictionary;
  state: "open" | "soon";
  turnout: Turnout | null;
}) {
  const t = s.adminHome.overview;
  const roomPercent = turnout && turnout.roomsEligible > 0 ? (turnout.roomsVoted / turnout.roomsEligible) * 100 : 0;
  const ownershipPercent =
    turnout && turnout.ownershipTotal > 0 ? (turnout.ownershipVoted / turnout.ownershipTotal) * 100 : 0;
  const quorum = turnout?.quorum;
  const quorumText =
    !quorum || quorum.met === null
      ? t.quorumUnknown
      : quorum.required_percent === 0
        ? t.quorumNone
        : quorum.met
          ? t.quorumMet
          : fill(t.quorumNotYet, { percent: percentText(quorum.required_percent ?? 0) });

  return (
    <article
      className="grid gap-4 rounded-lg border-2 border-[var(--primary)] bg-[var(--surface)] p-5"
      data-spotlight-meeting={meeting.id}
      data-spotlight-state={state}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              state === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {state === "open" ? t.openNow : t.opensSoon}
          </span>
          <h3 className="mt-2 text-xl font-semibold [overflow-wrap:anywhere]">{meeting.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {fill(t.window, {
              start: formatDateTimeIn(locale, meeting.starts_at),
              end: formatDateTimeIn(locale, meeting.ends_at),
            })}
          </p>
          <p className="mt-1 text-sm font-medium" data-time-left>
            {fill(state === "open" ? t.closesIn : t.opensIn, {
              time: timeUntil(state === "open" ? meeting.ends_at : meeting.starts_at, t, now),
            })}
          </p>
        </div>
        {href ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            href={href}
          >
            {t.openMeeting} →
          </Link>
        ) : null}
      </div>
      {state === "open" && turnout ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div data-turnout-rooms>
              <p className="text-sm text-[var(--muted)]">{t.roomsVoted}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {fill(t.ofTotal, { voted: turnout.roomsVoted, total: turnout.roomsEligible })}
              </p>
              <Bar value={roomPercent} />
            </div>
            <div data-turnout-ownership>
              <p className="text-sm text-[var(--muted)]">{t.ownershipVoted}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {fill(t.ofTotal, {
                  voted: percentText(turnout.ownershipVoted),
                  total: percentText(turnout.ownershipTotal),
                })}
              </p>
              <Bar marker={quorum?.required_percent} value={ownershipPercent} />
            </div>
          </div>
          <p
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              quorum?.met ? "bg-emerald-50 text-emerald-800" : "bg-[var(--background)]"
            }`}
            data-quorum={quorum?.met === true ? "met" : quorum?.met === false ? "not-met" : "unknown"}
          >
            {quorumText}
          </p>
          <p className="text-xs text-[var(--muted)]">{t.resultsHidden}</p>
        </>
      ) : null}
    </article>
  );
}
