import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { ListChecks } from "lucide-react";
import { ballotAnswers, type BallotAnswer } from "@/features/admin/components/sections/voting/ballot-answers";
import { formatDateTime } from "@/features/admin/components/sections/shared/format";
import { takesPaperBallots, votingOpen } from "@/features/admin/meeting-pickers";
import { meetingSearchOptions } from "@/features/ui/search-options";
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

const ANSWERS_SHOWN = 3;

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
  const { locale, s } = await getStaffI18n();
  // Only meetings that take paper ballots (2026-11-19), newest first, with
  // whether voting is still open as the hint.
  const paperMeetingOptions = meetingSearchOptions(
    meetings
      .filter((meeting) => takesPaperBallots(meeting))
      .sort((left, right) => right.starts_at.localeCompare(left.starts_at)),
    (meeting) =>
      votingOpen(meeting)
        ? fill(s.voting.meetingOpenUntil, { date: formatDateTime(meeting.ends_at) })
        : s.voting.meetingVotingEnded,
  );
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
  // Words instead of codes (2026-11-19 review): where the paper ballot came
  // from, whether it is linked to a user, and the voter's name, not an id.
  const profileName = new Map(
    profiles.map((profile) => [profile.id, profile.full_name ?? profile.email]),
  );
  const sourceText = (label: string | null) =>
    label === "manual_on_site"
      ? s.voting.sourceOnSite
      : label === "manual_pending_identity"
        ? s.voting.sourcePendingIdentity
        : label?.trim() || s.voting.sourcePaper;
  const identityText = (status: string | null) =>
    status === "linked"
      ? s.voting.identityLinked
      : status === "pending"
        ? s.voting.identityPending
        : s.voting.identityLegacy;
  const voterName = (manualBallot: (typeof manualBallots)[number]) =>
    (manualBallot.voter_profile_id && profileName.get(manualBallot.voter_profile_id)) ||
    manualBallot.voter_identity_text ||
    "-";
  // One row per paper ballot, its answers listed inside (was one row per
  // answer, so a room repeated once per agenda item).
  const manualVoteRows = manualBallots.map((manualBallot) => ({
    answers: ballotAnswers(manualBallot.manual_ballot_answers, locale),
    counted: manualBallot.status !== "draft",
    identityStatus: manualBallot.identity_status ?? "legacy",
    manualBallotId: manualBallot.id,
    meetingTitle: manualBallot.meetings?.title ?? "-",
    note: manualBallot.audit_note,
    roomNumber: manualBallot.rooms?.room_number ?? "-",
    source: sourceText(manualBallot.source_label),
    voter: voterName(manualBallot),
  }));
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
    const byRoom = manualVoteTableFilters.sort === "room";
    const leftValue = byRoom ? left.roomNumber : left.meetingTitle;
    const rightValue = byRoom ? right.roomNumber : right.meetingTitle;

    return (
      leftValue.localeCompare(rightValue) * direction ||
      left.roomNumber.localeCompare(right.roomNumber)
    );
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

  const badgeClass = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  const identityBadge = (status: string) => (
    <span
      className={[
        badgeClass,
        status === "linked"
          ? "bg-green-50 text-green-800"
          : status === "pending"
            ? "bg-amber-100 text-amber-900"
            : "bg-[var(--background)] text-[var(--muted)]",
      ].join(" ")}
    >
      {identityText(status)}
    </span>
  );
  // Long agendas (2026-11-19): the first few items, the rest folded away,
  // so a ballot stays a few lines high however many items the meeting has.
  const answerItem = (answer: BallotAnswer) => (
    <li key={answer.questionId}>
      <span className="text-[var(--muted)]">{answer.question}</span>
      <span aria-hidden="true"> → </span>
      <span className="font-medium">{answer.choices}</span>
    </li>
  );
  const answerList = (row: (typeof manualVoteRows)[number]) =>
    row.answers.length === 0 ? (
      <p className="mt-1 text-[var(--muted)]">{s.voting.noAnswers}</p>
    ) : (
      <div className="mt-1">
        <ul className="grid gap-1">{row.answers.slice(0, ANSWERS_SHOWN).map(answerItem)}</ul>
        {row.answers.length > ANSWERS_SHOWN ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-medium text-[var(--primary)]">
              {fill(s.voting.moreAgendaItems, { count: row.answers.length - ANSWERS_SHOWN })}
            </summary>
            <ul className="mt-1 grid gap-1">{row.answers.slice(ANSWERS_SHOWN).map(answerItem)}</ul>
          </details>
        ) : null}
      </div>
    );
  const voterBlock = (row: (typeof manualVoteRows)[number]) => (
    <div className="mt-2 grid gap-1 md:mt-0">
      <span className="font-medium [overflow-wrap:anywhere]">{row.voter}</span>
      <span className="flex flex-wrap gap-1">
        {identityBadge(row.identityStatus)}
        {row.counted ? null : (
          <span className={`${badgeClass} bg-[var(--background)] text-[var(--muted)]`}>{s.voting.ballotNotCounted}</span>
        )}
      </span>
      <span className="text-xs text-[var(--muted)]">{row.source}</span>
      {row.note ? (
        <span className="text-xs text-[var(--muted)] [overflow-wrap:anywhere]">{fill(s.voting.note, { text: row.note })}</span>
      ) : null}
    </div>
  );
  const pendingItem = (manualBallot: (typeof manualBallots)[number]) => (
    <li
      className="grid gap-2 rounded-md border border-amber-200 bg-white p-3 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center"
      data-pending-ballot-id={manualBallot.id}
      key={manualBallot.id}
    >
      <span className="font-medium [overflow-wrap:anywhere]">{manualBallot.meetings?.title ?? "-"}</span>
      <span className="[overflow-wrap:anywhere]">{s.voting.room} {manualBallot.rooms?.room_number ?? "-"}</span>
      <span className="grid gap-1">
        <span className="[overflow-wrap:anywhere]">
          {manualBallot.voter_identity_text ?? manualBallot.audit_note ?? "-"}
        </span>
        <span className="flex flex-wrap gap-1">
          {identityBadge(manualBallot.identity_status ?? "legacy")}
          {manualBallot.status === "draft" ? (
            <span className={`${badgeClass} bg-white text-amber-900 ring-1 ring-amber-200`}>{s.voting.ballotNotCounted}</span>
          ) : null}
        </span>
      </span>
      <a
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900"
        href={`${manualVoteListHref}&mode=edit&type=manual_vote_identity&id=${manualBallot.id}`}
      >
        {s.voting.linkProfile}
      </a>
    </li>
  );

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="voting"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {/* The page header already explains the page (2026-11-19 review). */}
        <div className="flex items-center gap-2">
          <ListChecks className="text-[var(--primary)]" size={20} />
          <h2 className="text-lg font-semibold">{s.voting.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            href="/admin/voting/conflicts"
          >
            {s.voting.reviewConflicts}
          </a>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            href={`${manualVoteListHref}&mode=create&type=manual_vote`}
          >
            {s.voting.importManual}
          </a>
        </div>
      </div>

      {pendingManualVoteIdentities.length > 0 ? (
        <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4" data-pending-identities>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-amber-950">
              {s.voting.pendingTitle}
            </h3>
            <p className="mt-1 text-xs text-amber-900">
              {s.voting.pendingText}
            </p>
          </div>
          {/* A list that stacks on phones; the first five, then the rest
              behind "Show all" (2026-11-19 review). */}
          <ul className="grid gap-2">
            {pendingManualVoteIdentities.slice(0, 5).map((manualBallot) => pendingItem(manualBallot))}
          </ul>
          {pendingManualVoteIdentities.length > 5 ? (
            <details className="mt-2">
              <summary className="tap-target inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-amber-950">
                {fill(s.voting.showAllPending, { count: pendingManualVoteIdentities.length })}
              </summary>
              <ul className="mt-2 grid gap-2">
                {pendingManualVoteIdentities.slice(5).map((manualBallot) => pendingItem(manualBallot))}
              </ul>
            </details>
          ) : null}
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
      {/* Phones: one card per paper ballot. */}
      <ul className="grid gap-3 md:hidden" data-manual-cards>
        {pagedManualVoteRows.map((row) => (
          <li
            className={[
              "rounded-lg border border-[var(--border)] p-4 text-sm",
              focusedManualBallotId === row.manualBallotId ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]" : "",
            ].join(" ")}
            data-manual-ballot-id={row.manualBallotId}
            key={row.manualBallotId}
            tabIndex={-1}
          >
            <p className="font-semibold [overflow-wrap:anywhere]">{row.meetingTitle}</p>
            <p className="text-[var(--muted)]">{s.voting.room} {row.roomNumber}</p>
            {answerList(row)}
            {voterBlock(row)}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
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
              <th className="py-2 pr-3 font-medium">{s.voting.answers}</th>
              <th className="py-2 font-medium">{s.voting.voter}</th>
            </tr>
          </thead>
          <tbody>
            {pagedManualVoteRows.map((row) => (
              <tr
                className={[
                  "border-b border-[var(--border)] align-top",
                  focusedManualBallotId === row.manualBallotId
                    ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                    : "",
                ].join(" ")}
                data-manual-ballot-id={row.manualBallotId}
                key={row.manualBallotId}
                tabIndex={-1}
              >
                <td className="py-3 pr-3 [overflow-wrap:anywhere]">{row.meetingTitle}</td>
                <td className="py-3 pr-3 [overflow-wrap:anywhere]">{row.roomNumber}</td>
                <td className="py-3 pr-3">{answerList(row)}</td>
                <td className="py-3">{voterBlock(row)}</td>
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
          meetingOptions={paperMeetingOptions}
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
