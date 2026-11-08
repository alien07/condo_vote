import { ListChecks } from "lucide-react";
import { EmailInviteControls } from "@/features/admin/components/email-invite-controls";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { EmailLogDetailDrawer, EmailLogRowFocus } from "@/features/admin/components/email-log-detail-drawer";
import { emailHref } from "@/features/admin/components/sections/communications/email-hrefs";
import { formatDateTime } from "@/features/admin/components/sections/shared/format";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  EmailTableFilters,
} from "@/features/admin/components/sections/types";

type EmailSectionProps = Pick<AdminDashboardData, "emailLogs" | "meetings"> &
  Pick<
    AdminWorkspaceProps,
    "drawer"
    | "emailFilters"
    | "focusedEmailLogId"
  > & {
  hidden: boolean;
};

export function EmailSection({
  drawer,
  emailFilters,
  emailLogs,
  focusedEmailLogId,
  meetings,
  hidden,
}: EmailSectionProps) {
  const emailTableFilters: Required<EmailTableFilters> = {
    created: emailFilters?.created ?? "",
    dir: emailFilters?.dir ?? "asc",
    page: tablePage(emailFilters?.page),
    perPage: tablePerPage(emailFilters?.perPage),
    recipient: emailFilters?.recipient ?? "",
    sort: emailFilters?.sort ?? "recipient",
    status: emailFilters?.status ?? "all",
  };
  const filteredEmailLogs = emailLogs.filter((log) => {
    const recipientQuery = emailTableFilters.recipient.trim().toLowerCase();
    const matchesRecipient = recipientQuery
      ? log.recipient_email.toLowerCase().includes(recipientQuery)
      : true;
    const matchesStatus =
      emailTableFilters.status === "all"
        ? true
        : log.status === emailTableFilters.status;
    const matchesCreated = emailTableFilters.created
      ? log.created_at.slice(0, 10) === emailTableFilters.created
      : true;

    return matchesRecipient && matchesStatus && matchesCreated;
  });
  const sortedEmailLogs = [...filteredEmailLogs].sort((left, right) => {
    const direction = emailTableFilters.dir === "asc" ? 1 : -1;
    const leftValue =
      emailTableFilters.sort === "created"
        ? left.created_at
        : emailTableFilters.sort === "status"
          ? left.status
          : left.recipient_email;
    const rightValue =
      emailTableFilters.sort === "created"
        ? right.created_at
        : emailTableFilters.sort === "status"
          ? right.status
          : right.recipient_email;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const emailTotal = sortedEmailLogs.length;
  const emailTotalPages = Math.max(
    1,
    Math.ceil(emailTotal / emailTableFilters.perPage),
  );
  const emailPage = Math.min(emailTableFilters.page, emailTotalPages);
  const emailPageStart =
    emailTotal === 0 ? 0 : (emailPage - 1) * emailTableFilters.perPage + 1;
  const emailPageEnd = Math.min(emailPage * emailTableFilters.perPage, emailTotal);
  const pagedEmailLogs = sortedEmailLogs.slice(
    (emailPage - 1) * emailTableFilters.perPage,
    emailPage * emailTableFilters.perPage,
  );
  const emailListHref = emailHref({
    ...emailTableFilters,
    page: emailPage,
  });
  const emailPageUrls = Object.fromEntries(
    Array.from({ length: emailTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        emailHref({ ...emailTableFilters, page: pageNumber }),
      ],
    ),
  );
  const emailPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      emailHref({ ...emailTableFilters, page: 1, perPage }),
    ]),
  );
  const emailSortHref = (sort: Required<EmailTableFilters>["sort"]) =>
    emailHref({
      ...emailTableFilters,
      dir:
        emailTableFilters.sort === sort && emailTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const emailSortLabel = (sort: Required<EmailTableFilters>["sort"]) =>
    emailTableFilters.sort === sort
      ? emailTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="email"
    >
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">Email Queue</h2>
      </div>
      <EmailInviteControls meetings={meetings} />
      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Search Criteria</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter email logs by recipient, status, and created date.
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input name="sort" type="hidden" value={emailTableFilters.sort} />
          <input name="dir" type="hidden" value={emailTableFilters.dir} />
          <input
            name="perPage"
            type="hidden"
            value={emailTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            Recipient
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={emailTableFilters.recipient}
              name="recipient"
              placeholder="Search email"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Status
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={emailTableFilters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="permanent_failed">Permanent failed</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            Created
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={emailTableFilters.created}
              name="created"
              type="date"
            />
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-2">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              Search
            </button>
            <a
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              href="/admin/communications"
            >
              Clear
            </a>
          </div>
        </form>
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Email Delivery Logs</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Showing {emailPageStart}-{emailPageEnd} of {emailTotal}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label="Page"
            options={Array.from(
              { length: emailTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={emailPageUrls}
            value={emailPage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            of {emailTotalPages}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label="Per page"
            urlByValue={emailPerPageUrls}
            value={emailTableFilters.perPage}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <a href={emailSortHref("recipient")}>
                  Recipient{emailSortLabel("recipient")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">Template</th>
              <th className="py-2 pr-3 font-medium">
                <a href={emailSortHref("status")}>
                  Status{emailSortLabel("status")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={emailSortHref("created")}>
                  Created{emailSortLabel("created")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">Error</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedEmailLogs.map((log) => {
              const selected =
                drawer?.mode === "view" &&
                drawer.type === "email_log" &&
                drawer.id === log.id;
              const focused = focusedEmailLogId === log.id;

              return (
                <tr
                  className={[
                    "border-b border-[var(--border)]",
                    selected || focused
                      ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                      : "",
                  ].join(" ")}
                  data-email-log-id={log.id}
                  key={log.id}
                  tabIndex={-1}
                >
                  <td className="py-2 pr-3">{log.recipient_email}</td>
                  <td className="py-2 pr-3">{log.template_key}</td>
                  <td className="py-2 pr-3">{log.status}</td>
                  <td className="py-2 pr-3">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="py-2 pr-3">{log.error_message ?? "-"}</td>
                  <td className="py-2">
                    <a
                      className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                      href={`${emailListHref}&mode=view&type=email_log&id=${log.id}`}
                    >
                      View details
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagedEmailLogs.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No email logs match the selected criteria.
        </p>
      ) : null}
      <EmailLogRowFocus logId={focusedEmailLogId} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={emailPage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            emailPage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={emailHref({
            ...emailTableFilters,
            page: Math.max(1, emailPage - 1),
          })}
        >
          Previous
        </a>
        <div className="text-sm text-[var(--muted)]">
          {emailPageStart}-{emailPageEnd} / {emailTotal}
        </div>
        <a
          aria-disabled={emailPage >= emailTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            emailPage >= emailTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={emailHref({
            ...emailTableFilters,
            page: Math.min(emailTotalPages, emailPage + 1),
          })}
        >
          Next
        </a>
      </div>
      {drawer?.mode === "view" && drawer.type === "email_log"
        ? emailLogs
            .filter((log) => log.id === drawer.id)
            .map((log) => (
              <EmailLogDetailDrawer
                closeHref={emailListHref}
                createdLabel={formatDateTime(log.created_at)}
                key={log.id}
                log={log}
                sentLabel={log.sent_at ? formatDateTime(log.sent_at) : "-"}
              />
            ))
        : null}
    </section>
  );
}
