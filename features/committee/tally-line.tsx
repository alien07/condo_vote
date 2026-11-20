import type { ReactNode } from "react";
import type { CommitteeTally } from "@/features/results/committee-service";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { committeePositionLabel } from "@/lib/i18n/committee-position";
import { fill } from "@/lib/i18n/template";

const tone: Record<string, string> = {
  open: "border border-[var(--border)] text-[var(--muted)]",
  passed: "bg-emerald-100 text-emerald-800",
  not_passed: "bg-[var(--danger-surface)] text-[var(--danger)]",
  tie: "bg-amber-100 text-amber-900",
};

/** "Approved a · Not approved b · Needs n of N" and the decision so far
 * (req_0011 A, D027). `children` is the "i" tip with who answered. */
export function TallyLine({
  children,
  t,
  tally,
}: {
  children?: ReactNode;
  t: StaffDictionary["committee"];
  tally: CommitteeTally;
}) {
  const cast = tally.casting_vote;

  return (
    <div className="grid gap-1 text-sm" data-tally data-tally-status={tally.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[tally.status] ?? tone.open}`}>
          {t.tallyStatus[tally.status] ?? tally.status}
        </span>
        <span data-tally-line>
          {fill(t.tallyLine, {
            approvals: tally.approvals,
            objections: tally.objections,
            required: tally.required,
            members: tally.members,
          })}
        </span>
        {children}
      </div>
      {tally.high_level ? <p className="font-medium text-[var(--danger)]">{t.allMembersNeeded}</p> : null}
      {cast ? (
        <p className="text-[var(--muted)]" data-casting-vote>
          {fill(t.castBy, {
            position: committeePositionLabel(t.positions, cast.position, null),
            name: cast.name ?? "-",
            decision: cast.decision === "approve" ? t.castApprove : t.castObject,
          })}
        </p>
      ) : null}
    </div>
  );
}
