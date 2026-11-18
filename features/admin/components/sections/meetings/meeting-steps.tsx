import { Check } from "lucide-react";
import { meetingDrawerHref } from "@/features/admin/components/sections/meetings/meeting-hrefs";
import {
  PublishMeetingForm,
  readinessReason,
} from "@/features/admin/components/sections/meetings/publish-meeting-form";
import type { MeetingReadiness } from "@/features/admin/meeting-readiness";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

type StepsMeeting = {
  english_checked_at?: string | null;
  ends_at: string;
  id: string;
  starts_at: string;
  title: string;
  title_en?: string | null;
};

type Step = {
  key: string;
  title: string;
  done: boolean;
  note: string;
  action?: React.ReactNode;
};

const linkClass =
  "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm font-medium text-[var(--primary)]";

/**
 * Where a draft meeting's setup stands (2026-11-18 review): details, agenda
 * and choices, English (with two-language documents), then check and
 * publish. Shown on the meeting's agenda page.
 */
export async function MeetingSteps({
  bilingual,
  count,
  meeting,
  readiness,
}: {
  bilingual: boolean;
  count: number;
  meeting: StepsMeeting;
  readiness: MeetingReadiness;
}) {
  const { s } = await getStaffI18n();
  const englishDone = Boolean(meeting.title_en && meeting.english_checked_at);
  const steps: Step[] = [
    {
      key: "info",
      title: s.meetings.stepInfo,
      done: true,
      note: meeting.title,
      action: (
        <a className={linkClass} href={meetingDrawerHref("/admin/meetings?tab=meetings", { id: meeting.id, mode: "edit" })}>
          {s.meetings.stepEditInfo}
        </a>
      ),
    },
    {
      key: "agenda",
      title: s.meetings.stepAgenda,
      done: readiness.ready,
      note: readiness.ready
        ? fill(s.meetings.stepAgendaCount, { count })
        : await readinessReason(readiness),
    },
    ...(bilingual
      ? [
          {
            key: "english",
            title: s.meetings.stepEnglish,
            done: englishDone,
            note: englishDone ? s.meetings.stepDone : s.meetings.stepEnglishTodo,
            action: (
              <a className={linkClass} href={`/admin/meetings/${meeting.id}/english`}>
                {s.english.openEditor}
              </a>
            ),
          },
        ]
      : []),
    {
      key: "publish",
      title: s.meetings.stepPublish,
      done: false,
      note: s.meetings.stepPublishHelp,
      // English first when documents are in two languages.
      action: readiness.ready && (!bilingual || englishDone) ? (
        <PublishMeetingForm
          className="inline-flex min-h-10 items-center rounded-md bg-[var(--primary)] px-4 py-1 text-sm font-medium text-[var(--primary-foreground)]"
          count={count}
          meeting={meeting}
          readiness={readiness}
        />
      ) : undefined,
    },
  ];

  return (
    <nav aria-label={s.meetings.steps} className="mb-4" data-meeting-steps>
      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li
            className={[
              "flex flex-col gap-2 rounded-lg border p-3 text-sm",
              step.done
                ? "border-[var(--border)] bg-[var(--surface)]"
                : "border-[var(--primary)]/40 bg-[var(--background)]",
            ].join(" ")}
            data-step={step.key}
            data-step-done={step.done || undefined}
            key={step.key}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                  step.done
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] bg-[var(--surface)]",
                ].join(" ")}
              >
                {step.done ? <Check size={14} /> : index + 1}
              </span>
              <span>{step.title}</span>
              {step.done ? <span className="sr-only">({s.meetings.stepDone})</span> : null}
            </div>
            <p className="text-[var(--muted)] [overflow-wrap:anywhere]">{step.note}</p>
            {step.action ? <div className="mt-auto">{step.action}</div> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
