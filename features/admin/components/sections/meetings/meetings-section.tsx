import { CalendarDays } from "lucide-react";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { archiveMeeting, generateResultSnapshot, publishMeeting } from "@/features/admin/actions";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { MeetingCrudDrawer, MeetingRowFocus } from "@/features/admin/components/meeting-crud-drawer";
import { meetingDrawerHref, meetingHref } from "@/features/admin/components/sections/meetings/meeting-hrefs";
import { formatDateTime } from "@/features/admin/components/sections/shared/format";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  MeetingTableFilters,
} from "@/features/admin/components/sections/types";
import type {
  SharedAdminState,
} from "@/features/admin/components/sections/shared/derived";

type MeetingsSectionProps = Pick<AdminDashboardData, "meetings"> &
  Pick<
    SharedAdminState,
    "approvedMeetingIds"
    | "pendingManualBallotsByMeetingId"
  > &
  Pick<
    AdminWorkspaceProps,
    "drawer"
    | "focusedMeetingId"
    | "meetingFilters"
  > & {
  hidden: boolean;
};

export function MeetingsSection({
  approvedMeetingIds,
  drawer,
  focusedMeetingId,
  meetingFilters,
  meetings,
  pendingManualBallotsByMeetingId,
  hidden,
}: MeetingsSectionProps) {
  const meetingTableFilters: Required<MeetingTableFilters> = {
    dir: meetingFilters?.dir ?? "asc",
    noType: meetingFilters?.noType ?? "",
    page: tablePage(meetingFilters?.page),
    perPage: tablePerPage(meetingFilters?.perPage),
    sort: meetingFilters?.sort ?? "title",
    status: meetingFilters?.status ?? "all",
    title: meetingFilters?.title ?? "",
  };
  const filteredMeetings = meetings.filter((meeting) => {
    const effectiveStatus = approvedMeetingIds.has(meeting.id)
      ? "approved"
      : meeting.status;
    const titleQuery = meetingTableFilters.title.trim().toLowerCase();
    const noTypeQuery = meetingTableFilters.noType.trim().toLowerCase();
    const matchesTitle = titleQuery
      ? meeting.title.toLowerCase().includes(titleQuery)
      : true;
    const matchesNoType = noTypeQuery
      ? [meeting.meeting_number ?? "", meeting.meeting_type ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(noTypeQuery)
      : true;
    const matchesStatus =
      meetingTableFilters.status === "all"
        ? true
        : effectiveStatus === meetingTableFilters.status;

    return matchesTitle && matchesNoType && matchesStatus;
  });
  const sortedMeetings = [...filteredMeetings].sort((left, right) => {
    const direction = meetingTableFilters.dir === "asc" ? 1 : -1;
    const leftStatus = approvedMeetingIds.has(left.id) ? "approved" : left.status;
    const rightStatus = approvedMeetingIds.has(right.id)
      ? "approved"
      : right.status;
    const leftValue =
      meetingTableFilters.sort === "status"
        ? leftStatus
        : meetingTableFilters.sort === "window"
          ? left.starts_at
          : meetingTableFilters.sort === "no_type"
            ? `${left.meeting_number ?? ""} ${left.meeting_type ?? ""}`
            : left.title;
    const rightValue =
      meetingTableFilters.sort === "status"
        ? rightStatus
        : meetingTableFilters.sort === "window"
          ? right.starts_at
          : meetingTableFilters.sort === "no_type"
            ? `${right.meeting_number ?? ""} ${right.meeting_type ?? ""}`
            : right.title;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const meetingTotal = sortedMeetings.length;
  const meetingTotalPages = Math.max(
    1,
    Math.ceil(meetingTotal / meetingTableFilters.perPage),
  );
  const meetingPage = Math.min(meetingTableFilters.page, meetingTotalPages);
  const meetingPageStart =
    meetingTotal === 0 ? 0 : (meetingPage - 1) * meetingTableFilters.perPage + 1;
  const meetingPageEnd = Math.min(
    meetingPage * meetingTableFilters.perPage,
    meetingTotal,
  );
  const pagedMeetings = sortedMeetings.slice(
    (meetingPage - 1) * meetingTableFilters.perPage,
    meetingPage * meetingTableFilters.perPage,
  );
  const meetingListHref = meetingHref(meetingTableFilters);
  const meetingFocusId =
    drawer?.mode === "edit" && drawer.type === "meeting"
      ? drawer.id
      : focusedMeetingId;
  const meetingPageUrls = Object.fromEntries(
    Array.from({ length: meetingTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        meetingHref({ ...meetingTableFilters, page: pageNumber }),
      ],
    ),
  );
  const meetingPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      meetingHref({ ...meetingTableFilters, page: 1, perPage }),
    ]),
  );
  const meetingSortHref = (sort: Required<MeetingTableFilters>["sort"]) =>
    meetingHref({
      ...meetingTableFilters,
      dir:
        meetingTableFilters.sort === sort && meetingTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const meetingSortLabel = (sort: Required<MeetingTableFilters>["sort"]) =>
    meetingTableFilters.sort === sort
      ? meetingTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const selectedMeeting = meetings.find((meeting) => meeting.id === drawer?.id);
  const showMeetingDrawer =
    drawer?.type === "meeting" &&
    (drawer.mode === "create" ||
      (drawer.mode === "edit" && selectedMeeting?.status === "draft"));

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="meetings"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">Meetings</h2>
            <p className="text-sm text-[var(--muted)]">
              Maintain meeting master data and voting windows.
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href={meetingDrawerHref(meetingListHref, { mode: "create" })}
        >
          Add meeting
        </a>
      </div>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Search Criteria</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Filter meetings by title, meeting number/type, and status.
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input name="tab" type="hidden" value="meetings" />
          <input name="sort" type="hidden" value={meetingTableFilters.sort} />
          <input name="dir" type="hidden" value={meetingTableFilters.dir} />
          <input
            name="perPage"
            type="hidden"
            value={meetingTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            Title
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={meetingTableFilters.title}
              name="title"
              placeholder="Search title"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            No./Type
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={meetingTableFilters.noType}
              name="noType"
              placeholder="Search meeting no. or type"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-2">
            Status
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={meetingTableFilters.status}
              name="status"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
              <option value="approved">Approved</option>
            </select>
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
              href="/admin/meetings?tab=meetings"
            >
              Clear
            </a>
          </div>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Results</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Showing {meetingPageStart}-{meetingPageEnd} of {meetingTotal}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label="Page"
            options={Array.from(
              { length: meetingTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={meetingPageUrls}
            value={meetingPage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            of {meetingTotalPages}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label="Per page"
            urlByValue={meetingPerPageUrls}
            value={meetingTableFilters.perPage}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <a href={meetingSortHref("title")}>
                  Title{meetingSortLabel("title")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={meetingSortHref("no_type")}>
                  No./Type{meetingSortLabel("no_type")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={meetingSortHref("window")}>
                  Window{meetingSortLabel("window")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={meetingSortHref("status")}>
                  Status{meetingSortLabel("status")}
                </a>
              </th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedMeetings.map((meeting) => {
              const hasApprovedResult = approvedMeetingIds.has(meeting.id);
              const pendingManualCount =
                pendingManualBallotsByMeetingId.get(meeting.id)?.length ?? 0;

              const focused = meetingFocusId === meeting.id;

              return (
                <tr
                  className={[
                    "border-b border-[var(--border)]",
                    focused
                      ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                      : "",
                  ].join(" ")}
                  data-meeting-id={meeting.id}
                  key={meeting.id}
                  tabIndex={-1}
                >
                  <td className="py-2 pr-3">{meeting.title}</td>
                  <td className="py-2 pr-3">
                    {meeting.meeting_number ?? "-"} / {meeting.meeting_type}
                  </td>
                  <td className="py-2 pr-3">
                    {formatDateTime(meeting.starts_at)} -{" "}
                    {formatDateTime(meeting.ends_at)}
                  </td>
                  <td className="py-2 pr-3">
                    {hasApprovedResult ? "approved" : meeting.status}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {meeting.status === "draft" ? (
                        <>
                          <a
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                            href={meetingDrawerHref(meetingListHref, {
                              id: meeting.id,
                              mode: "edit",
                            })}
                          >
                            Edit
                          </a>
                          <form action={publishMeeting}>
                            <input name="id" type="hidden" value={meeting.id} />
                            <PendingSubmitButton
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                              pendingLabel="Publishing..."
                              type="submit"
                            >
                              Publish
                            </PendingSubmitButton>
                          </form>
                        </>
                      ) : null}
                      {meeting.status !== "archived" ? (
                        <form action={archiveMeeting}>
                          <input name="id" type="hidden" value={meeting.id} />
                          <ConfirmSubmitButton
                            className="rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700"
                            confirmMessage={`Archive meeting "${meeting.title}"? This meeting will be hidden from active meeting workflows and cannot be published again without an admin change.`}
                            pendingLabel="Archiving..."
                            type="submit"
                          >
                            Archive
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                      {(meeting.status === "published" ||
                        meeting.status === "closed") &&
                      !hasApprovedResult ? (
                        pendingManualCount > 0 ? (
                          <a
                            className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                            href="/admin/voting"
                          >
                            Resolve {pendingManualCount} pending manual vote
                          </a>
                        ) : (
                          <form action={generateResultSnapshot}>
                            <input name="id" type="hidden" value={meeting.id} />
                            <PendingSubmitButton
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium text-[var(--primary)]"
                              pendingLabel="Generating..."
                              type="submit"
                            >
                              Generate result
                            </PendingSubmitButton>
                          </form>
                        )
                      ) : null}
                      {hasApprovedResult ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                          Result locked
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <MeetingRowFocus meetingId={meetingFocusId} />
      {pagedMeetings.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No meetings match the selected criteria.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={meetingPage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            meetingPage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={meetingHref({
            ...meetingTableFilters,
            page: Math.max(1, meetingPage - 1),
          })}
        >
          Previous
        </a>
        <div className="text-sm text-[var(--muted)]">
          {meetingPageStart}-{meetingPageEnd} / {meetingTotal}
        </div>
        <a
          aria-disabled={meetingPage >= meetingTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            meetingPage >= meetingTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={meetingHref({
            ...meetingTableFilters,
            page: Math.min(meetingTotalPages, meetingPage + 1),
          })}
        >
          Next
        </a>
      </div>
      {meetings.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No meetings have been created yet.
        </p>
      ) : null}
      {showMeetingDrawer ? (
        <MeetingCrudDrawer
          closeHref={meetingListHref}
          meeting={selectedMeeting}
          mode={drawer?.mode === "edit" ? "edit" : "create"}
        />
      ) : null}
    </section>
  );
}
