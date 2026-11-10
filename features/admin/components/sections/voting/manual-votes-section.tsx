import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { ListChecks } from "lucide-react";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { ManualVoteIdentityDrawer, ManualVoteImportDrawer, ManualVoteRowFocus } from "@/features/admin/components/manual-vote-crud-drawer";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  ManualVoteTableFilters,
} from "@/features/admin/components/sections/types";
import { manualVoteHref } from "@/features/admin/components/sections/voting/manual-vote-hrefs";

type ManualVotesSectionProps = Pick<
    AdminDashboardData,
    "manualBallots"
    | "meetings"
    | "profiles"
    | "rooms"
  > &
  Pick<
    AdminWorkspaceProps,
    "drawer"
    | "focusedManualBallotId"
    | "manualVoteFilters"
  > & {
  hidden: boolean;
};

export async function ManualVotesSection({
  drawer,
  focusedManualBallotId,
  manualBallots,
  manualVoteFilters,
  meetings,
  profiles,
  rooms,
  hidden,
}: ManualVotesSectionProps) {
  const { s } = await getStaffI18n();
  const manualVoteTableFilters: Required<ManualVoteTableFilters> = {
    dir: manualVoteFilters?.dir ?? "asc",
    meeting: manualVoteFilters?.meeting ?? "",
    page: tablePage(manualVoteFilters?.page),
    perPage: tablePerPage(manualVoteFilters?.perPage),
    room: manualVoteFilters?.room ?? "",
    sort: manualVoteFilters?.sort ?? "meeting",
  };
  const pendingManualVoteIdentities = manualBallots.filter((manualBallot) => {
    if (
      manualBallot.identity_status !== "pending" &&
      manualBallot.status !== "draft"
    ) {
      return false;
    }

    const meetingQuery = manualVoteTableFilters.meeting.trim().toLowerCase();
    const roomQuery = manualVoteTableFilters.room.trim().toLowerCase();
    const meetingTitle = manualBallot.meetings?.title ?? "";
    const roomNumber = manualBallot.rooms?.room_number ?? "";
    const matchesMeeting = meetingQuery
      ? meetingTitle.toLowerCase().includes(meetingQuery)
      : true;
    const matchesRoom = roomQuery
      ? roomNumber.toLowerCase().includes(roomQuery)
      : true;

    return matchesMeeting && matchesRoom;
  });
  const manualVoteRows = manualBallots.flatMap((manualBallot) =>
    manualBallot.manual_ballot_answers.map((answer) => ({
      auditText: [
        manualBallot.source_label ?? "manual",
        manualBallot.identity_status ?? "legacy",
        manualBallot.voter_identity_text ??
          manualBallot.voter_profile_id ??
          manualBallot.audit_note ??
          "-",
      ].join(" / "),
      choiceText: answer.meeting_choices?.choice_text ?? "-",
      id: answer.id,
      manualBallotId: manualBallot.id,
      meetingTitle: manualBallot.meetings?.title ?? "-",
      questionText: answer.meeting_questions?.question_text ?? "-",
      roomNumber: manualBallot.rooms?.room_number ?? "-",
    })),
  );
  const filteredManualVoteRows = manualVoteRows.filter((row) => {
    const meetingQuery = manualVoteTableFilters.meeting.trim().toLowerCase();
    const roomQuery = manualVoteTableFilters.room.trim().toLowerCase();
    const matchesMeeting = meetingQuery
      ? row.meetingTitle.toLowerCase().includes(meetingQuery)
      : true;
    const matchesRoom = roomQuery
      ? row.roomNumber.toLowerCase().includes(roomQuery)
      : true;

    return matchesMeeting && matchesRoom;
  });
  const sortedManualVoteRows = [...filteredManualVoteRows].sort((left, right) => {
    const direction = manualVoteTableFilters.dir === "asc" ? 1 : -1;
    const leftValue =
      manualVoteTableFilters.sort === "question"
        ? left.questionText
        : manualVoteTableFilters.sort === "room"
          ? left.roomNumber
          : left.meetingTitle;
    const rightValue =
      manualVoteTableFilters.sort === "question"
        ? right.questionText
        : manualVoteTableFilters.sort === "room"
          ? right.roomNumber
          : right.meetingTitle;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const manualVoteTotal = sortedManualVoteRows.length;
  const manualVoteTotalPages = Math.max(
    1,
    Math.ceil(manualVoteTotal / manualVoteTableFilters.perPage),
  );
  const manualVotePage = Math.min(
    manualVoteTableFilters.page,
    manualVoteTotalPages,
  );
  const manualVotePageStart =
    manualVoteTotal === 0
      ? 0
      : (manualVotePage - 1) * manualVoteTableFilters.perPage + 1;
  const manualVotePageEnd = Math.min(
    manualVotePage * manualVoteTableFilters.perPage,
    manualVoteTotal,
  );
  const pagedManualVoteRows = sortedManualVoteRows.slice(
    (manualVotePage - 1) * manualVoteTableFilters.perPage,
    manualVotePage * manualVoteTableFilters.perPage,
  );
  const manualVotePageUrls = Object.fromEntries(
    Array.from({ length: manualVoteTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        manualVoteHref({ ...manualVoteTableFilters, page: pageNumber }),
      ],
    ),
  );
  const manualVotePerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      manualVoteHref({ ...manualVoteTableFilters, page: 1, perPage }),
    ]),
  );
  const manualVoteSortHref = (
    sort: Required<ManualVoteTableFilters>["sort"],
  ) =>
    manualVoteHref({
      ...manualVoteTableFilters,
      dir:
        manualVoteTableFilters.sort === sort &&
        manualVoteTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const manualVoteSortLabel = (
    sort: Required<ManualVoteTableFilters>["sort"],
  ) =>
    manualVoteTableFilters.sort === sort
      ? manualVoteTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const manualVoteListHref = manualVoteHref({
    ...manualVoteTableFilters,
    page: manualVotePage,
  });

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="voting"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.voting.title}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.voting.intro}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href="/admin/voting/conflicts"
          >
            {s.voting.reviewConflicts}
          </a>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            href={`${manualVoteListHref}&mode=create&type=manual_vote`}
          >
            {s.voting.importManual}
          </a>
        </div>
      </div>

      {pendingManualVoteIdentities.length > 0 ? (
        <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-amber-950">
              {s.voting.pendingTitle}
            </h3>
            <p className="mt-1 text-xs text-amber-900">
              {s.voting.pendingText}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-amber-200 text-amber-900">
                <tr>
                  <th className="py-2 pr-3 font-medium">{s.voting.meeting}</th>
                  <th className="py-2 pr-3 font-medium">{s.voting.room}</th>
                  <th className="py-2 pr-3 font-medium">{s.voting.identity}</th>
                  <th className="py-2 pr-3 font-medium">{s.common.status}</th>
                  <th className="py-2 font-medium">{s.common.action}</th>
                </tr>
              </thead>
              <tbody>
                {pendingManualVoteIdentities.map((manualBallot) => (
                  <tr
                    className="border-b border-amber-200 last:border-0"
                    key={manualBallot.id}
                  >
                    <td className="py-2 pr-3">
                      {manualBallot.meetings?.title ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {manualBallot.rooms?.room_number ?? "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {manualBallot.voter_identity_text ??
                        manualBallot.audit_note ??
                        "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {codeLabel(s.common.code, manualBallot.identity_status)} /{" "}
                      {codeLabel(s.common.code, manualBallot.status)}
                    </td>
                    <td className="py-2">
                      <a
                        className="inline-flex min-h-9 items-center rounded-md border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900"
                        href={`${manualVoteListHref}&mode=edit&type=manual_vote_identity&id=${manualBallot.id}`}
                      >
                        {s.voting.linkProfile}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.voting.filter}
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input
            name="sort"
            type="hidden"
            value={manualVoteTableFilters.sort}
          />
          <input
            name="dir"
            type="hidden"
            value={manualVoteTableFilters.dir}
          />
          <input
            name="perPage"
            type="hidden"
            value={manualVoteTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            {s.voting.meeting}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={manualVoteTableFilters.meeting}
              name="meeting"
              placeholder={s.voting.searchMeeting}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
            {s.voting.room}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={manualVoteTableFilters.room}
              name="room"
              placeholder={s.voting.searchRoom}
            />
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-4">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              {s.common.search}
            </button>
            <a
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              href="/admin/voting"
            >
              {s.common.clear}
            </a>
          </div>
        </form>
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{s.common.results}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {fill(s.common.showing, { start: manualVotePageStart, end: manualVotePageEnd, total: manualVoteTotal })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label={s.common.page}
            options={Array.from(
              { length: manualVoteTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={manualVotePageUrls}
            value={manualVotePage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            {fill(s.common.ofPages, { total: manualVoteTotalPages })}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label={s.common.perPage}
            urlByValue={manualVotePerPageUrls}
            value={manualVoteTableFilters.perPage}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <a href={manualVoteSortHref("meeting")}>
                  {s.voting.meeting}{manualVoteSortLabel("meeting")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={manualVoteSortHref("room")}>
                  {s.voting.room}{manualVoteSortLabel("room")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={manualVoteSortHref("question")}>
                  {s.voting.question}{manualVoteSortLabel("question")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">{s.voting.choice}</th>
              <th className="py-2 font-medium">{s.voting.audit}</th>
            </tr>
          </thead>
          <tbody>
            {pagedManualVoteRows.map((row) => (
              <tr
                className={[
                  "border-b border-[var(--border)]",
                  focusedManualBallotId === row.manualBallotId
                    ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                    : "",
                ].join(" ")}
                data-manual-ballot-id={row.manualBallotId}
                key={row.id}
                tabIndex={-1}
              >
                <td className="py-2 pr-3">{row.meetingTitle}</td>
                <td className="py-2 pr-3">{row.roomNumber}</td>
                <td className="py-2 pr-3">{row.questionText}</td>
                <td className="py-2 pr-3">{row.choiceText}</td>
                <td className="py-2">{row.auditText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagedManualVoteRows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {s.voting.noRows}
        </p>
      ) : null}
      <ManualVoteRowFocus manualBallotId={focusedManualBallotId} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={manualVotePage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            manualVotePage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={manualVoteHref({
            ...manualVoteTableFilters,
            page: Math.max(1, manualVotePage - 1),
          })}
        >
          {s.common.previous}
        </a>
        <div className="text-sm text-[var(--muted)]">
          {manualVotePageStart}-{manualVotePageEnd} / {manualVoteTotal}
        </div>
        <a
          aria-disabled={manualVotePage >= manualVoteTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            manualVotePage >= manualVoteTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={manualVoteHref({
            ...manualVoteTableFilters,
            page: Math.min(manualVoteTotalPages, manualVotePage + 1),
          })}
        >
          {s.common.next}
        </a>
      </div>
      {drawer?.mode === "create" && drawer.type === "manual_vote" ? (
        <ManualVoteImportDrawer
          closeHref={manualVoteListHref}
          meetings={meetings}
          profiles={profiles}
          rooms={rooms}
        />
      ) : null}
      {drawer?.mode === "edit" && drawer.type === "manual_vote_identity"
        ? // Look up all manual ballots, not only pending ones: after a
          // successful save the ballot is no longer pending, and the drawer
          // must stay mounted to redirect with the success feedback.
          manualBallots
            .filter((manualBallot) => manualBallot.id === drawer.id)
            .map((manualBallot) => (
              <ManualVoteIdentityDrawer
                closeHref={manualVoteListHref}
                key={manualBallot.id}
                manualBallot={manualBallot}
                profiles={profiles}
              />
            ))
        : null}

    </section>
  );
}
