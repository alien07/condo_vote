import clsx from "clsx";
import type { VotingWindowStatus } from "@/features/voting/status";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

type VotingStatusBadgeProps = {
  status: VotingWindowStatus;
  submittedVersion?: number | null;
  locale: Locale;
};

export function VotingStatusBadge({
  status,
  submittedVersion,
  locale,
}: VotingStatusBadgeProps) {
  const t = getDictionary(locale).vote;
  const label = submittedVersion
    ? t.submittedVersion(submittedVersion)
    : t.status[status.label];
  const tone = submittedVersion
    ? status.canSubmit
      ? "submittedOpen"
      : "submittedClosed"
    : status.label;

  return (
    <span
      className={clsx(
        "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-sm font-medium",
        tone === "Open" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "Not open yet" &&
          "border-amber-200 bg-amber-50 text-amber-800",
        tone === "Closed" && "border-slate-200 bg-slate-50 text-slate-700",
        tone === "Unavailable" && "border-zinc-200 bg-zinc-50 text-zinc-700",
        tone === "submittedOpen" &&
          "border-teal-200 bg-teal-50 text-teal-800",
        tone === "submittedClosed" &&
          "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
