import type { ReactNode } from "react";
import { fill } from "@/lib/i18n/template";
import type { StaffDictionary } from "@/lib/i18n/staff";
import { deactivateCommitteeMember, reactivateCommitteeMember } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";

// Committee list rows: phone cards (md:hidden) and the table (md+), like
// Results and Email (setup review 2026-11-19). Both carry data-committee-id;
// CommitteeRowFocus picks the one that is visible.

export type CommitteeRow = {
  id: string;
  name: string;
  position: string;
  term: string;
  active: boolean;
  focused: boolean;
  editHref: string;
};

const badge = "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

function StatusBadge({ active, s }: { active: boolean; s: StaffDictionary }) {
  return (
    <span
      className={`${badge} ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
      data-committee-status={active ? "active" : "inactive"}
    >
      {active ? s.common.active : s.common.inactive}
    </span>
  );
}

function RowActions({ row, s }: { row: CommitteeRow; s: StaffDictionary }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
        href={row.editHref}
      >
        {s.common.edit}
      </a>
      <form action={row.active ? deactivateCommitteeMember : reactivateCommitteeMember}>
        <input name="id" type="hidden" value={row.id} />
        <ConfirmSubmitButton
          className={
            row.active
              ? "inline-flex min-h-11 items-center whitespace-nowrap rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
              : "inline-flex min-h-11 items-center whitespace-nowrap rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--primary)]"
          }
          confirmMessage={
            row.active
              ? fill(s.setup.confirmDeactivate, { name: row.name })
              : fill(s.setup.confirmReactivate, { name: row.name })
          }
          pendingLabel={row.active ? s.common.deactivating : s.common.reactivating}
          type="submit"
        >
          {row.active ? s.common.deactivate : s.common.reactivate}
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

const focusedClass = "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]";

export function CommitteeRows({
  rows,
  s,
  sortLink,
}: {
  rows: CommitteeRow[];
  s: StaffDictionary;
  sortLink: (sort: "name" | "position" | "status", label: string) => ReactNode;
}) {
  return (
    <>
      <ul className="grid gap-3 md:hidden" data-committee-cards>
        {rows.map((row) => (
          <li
            className={[
              "grid gap-2 rounded-lg border border-[var(--border)] p-3 text-sm",
              row.focused ? focusedClass : "",
            ].join(" ")}
            data-committee-id={row.id}
            key={row.id}
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{row.name}</span>
              <StatusBadge active={row.active} s={s} />
            </div>
            <span>{row.position}</span>
            <span className="text-xs text-[var(--muted)]">
              {s.setup.term}: {row.term}
            </span>
            <RowActions row={row} s={s} />
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">{sortLink("name", s.common.name)}</th>
              <th className="py-2 pr-3 font-medium">{sortLink("position", s.common.position)}</th>
              <th className="py-2 pr-3 font-medium">{s.setup.term}</th>
              <th className="py-2 pr-3 font-medium">{sortLink("status", s.common.status)}</th>
              <th className="py-2 font-medium">{s.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className={["border-b border-[var(--border)] align-top", row.focused ? focusedClass : ""].join(" ")}
                data-committee-id={row.id}
                key={row.id}
                tabIndex={-1}
              >
                <td className="py-3 pr-3 [overflow-wrap:anywhere]">{row.name}</td>
                <td className="py-3 pr-3">{row.position}</td>
                <td className="min-w-36 py-3 pr-3">{row.term}</td>
                <td className="py-3 pr-3">
                  <StatusBadge active={row.active} s={s} />
                </td>
                <td className="py-3">
                  <RowActions row={row} s={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
