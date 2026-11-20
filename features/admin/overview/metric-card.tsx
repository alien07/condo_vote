import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * One overview card (req_0008 items 4-5):
 * - with `href` the whole card is the link (44 px+, hover and focus, "→");
 *   without it the card is plainly informational;
 * - tone "waiting" is the only amber: something is waiting for the admin;
 *   "progress" is a white card with a bar; "complete" is green; "info" is
 *   neutral;
 * - `compact` draws one line, for a card with nothing waiting.
 */
export type MetricCardProps = {
  compact?: boolean;
  detail?: string;
  href?: string;
  icon: LucideIcon;
  label: string;
  percent?: number;
  status?: string;
  tone: "complete" | "info" | "progress" | "waiting";
  value: string;
};

const TONE = {
  waiting: "border-amber-300 bg-amber-50",
  complete: "border-[var(--border)] bg-[var(--surface)]",
  progress: "border-[var(--border)] bg-[var(--surface)]",
  info: "border-[var(--border)] bg-[var(--surface)]",
} as const;
const STATUS = {
  waiting: "text-amber-900",
  complete: "text-emerald-700",
  progress: "text-[var(--muted)]",
  info: "text-[var(--muted)]",
} as const;
const LINK =
  "transition hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

export function MetricCard({ compact, detail, href, icon: Icon, label, percent, status, tone, value }: MetricCardProps) {
  const arrow = href ? (
    <span aria-hidden="true" className="ml-auto text-[var(--primary)]">
      →
    </span>
  ) : null;
  const body = compact ? (
    <span className="flex min-h-11 items-center gap-2 text-sm">
      <Icon aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={16} />
      <span className="font-medium">{label}</span>
      <span className={`${STATUS[tone]} text-xs`}>{status ?? value}</span>
      {arrow}
    </span>
  ) : (
    <>
      <span className="flex items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
        <span className="text-sm font-medium [overflow-wrap:anywhere]">{label}</span>
        {arrow}
      </span>
      <span className="mt-2 block text-2xl font-semibold tabular-nums">{value}</span>
      {detail ? <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span> : null}
      {percent !== undefined ? (
        <span aria-hidden="true" className="mt-3 block h-2 overflow-hidden rounded-full bg-[var(--background)]">
          <span
            className={`block h-full rounded-full ${percent >= 100 ? "bg-emerald-600" : "bg-[var(--primary)]"}`}
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </span>
      ) : null}
      {status ? <span className={`mt-auto block pt-3 text-xs font-medium ${STATUS[tone]}`}>{status}</span> : null}
    </>
  );
  const className = compact
    ? `rounded-md border px-3 ${TONE[tone]}`
    : `flex min-h-full flex-col rounded-lg border p-4 ${TONE[tone]}`;

  return href ? (
    <Link className={`${className} ${LINK}`} data-metric={label} data-tone={tone} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className} data-metric={label} data-tone={tone}>
      {body}
    </div>
  );
}
