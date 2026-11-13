type LabelText = {
  roles: Record<string, string>;
  statuses: Record<string, string>;
  user: string;
};

const ROLE_ORDER = ["admin", "committee", "system_admin"];

/** Header label: job roles first, then member status, e.g.
 * "Committee · Resident" (demo feedback item 14e). */
export function accountLabel(roles: string[], status: string | null | undefined, text: LabelText) {
  const roleNames = [...roles]
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
    .map((role) => text.roles[role] ?? role);
  const statusName = status ? (text.statuses[status] ?? status) : null;
  const parts = [...roleNames, ...(statusName ? [statusName] : [])];

  return parts.length > 0 ? parts.join(" · ") : text.user;
}
