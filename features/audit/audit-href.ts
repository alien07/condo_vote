import type { AuditTab } from "@/features/audit/data";

/** An audit page URL (req_0007). The meeting is shared by every tab; dates
 * and paging belong to one tab, so a tab link leaves them out. */
export function auditHref(params: {
  tab: AuditTab;
  meeting?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}) {
  const query = new URLSearchParams({ tab: params.tab });

  if (params.meeting) query.set("meeting", params.meeting);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.perPage && params.perPage !== 25) query.set("perPage", String(params.perPage));

  return `/audit?${query.toString()}`;
}
