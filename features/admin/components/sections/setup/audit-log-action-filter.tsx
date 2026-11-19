"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import { groupAuditActions } from "@/features/admin/components/sections/setup/audit-log-labels";

// Action filter as grouped checkboxes in words (setup review 2026-11-19),
// in place of a <select multiple> of raw codes. The values stay the codes.

const choice =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal text-[var(--foreground)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]";

export function AuditActionFilter({
  actions,
  selected,
  onChange,
}: {
  actions: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { s } = useStaffText();
  // Codes in the URL that no row offers any more still show, so they can be unticked.
  const codes = [...new Set([...actions, ...selected])];
  const groups = groupAuditActions(s.auditLog, codes);

  return (
    <details
      className="group rounded-md border border-[var(--border)] bg-[var(--surface)]"
      data-audit-action-filter
      open={selected.length > 0 ? true : undefined}
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-[var(--foreground)]">
        <span>{s.common.actions}</span>
        <span className="text-xs font-normal text-[var(--muted)]">
          {selected.length > 0 ? fill(s.auditLog.selectedCount, { count: selected.length }) : s.setup.allActions}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-[var(--border)] p-3">
        <p className="text-xs font-normal text-[var(--muted)]">{s.auditLog.actionsHelp}</p>
        {groups.map((group) => (
          <fieldset className="grid min-w-0 gap-2" key={group.group}>
            <legend className="mb-1 text-xs font-semibold text-[var(--muted)]">{group.label}</legend>
            <div className="flex flex-wrap gap-2">
              {group.actions.map((action) => (
                <label className={choice} key={action.code}>
                  <input
                    checked={selected.includes(action.code)}
                    className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                    name="actions"
                    onChange={(event) =>
                      onChange(
                        event.currentTarget.checked
                          ? [...selected, action.code]
                          : selected.filter((code) => code !== action.code),
                      )
                    }
                    type="checkbox"
                    value={action.code}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{action.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </details>
  );
}
