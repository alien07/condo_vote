import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { UserCheck } from "lucide-react";
import { formatDateIn } from "@/lib/i18n/format";
import {
  COMMITTEE_POSITION_CODES,
  committeePositionLabel,
  committeePositionRank,
} from "@/lib/i18n/committee-position";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { CommitteeRows, type CommitteeRow } from "@/features/admin/components/sections/setup/committee-rows";
import { CommitteeCrudDrawer, CommitteeRowFocus } from "@/features/admin/components/committee-crud-drawer";
import { committeeDrawerHref, committeeHref } from "@/features/admin/components/sections/setup/committee-hrefs";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  CommitteeTableFilters,
} from "@/features/admin/components/sections/types";

type CommitteeSectionProps = Pick<AdminDashboardData, "committeeMembers" | "profiles"> &
  Pick<
    AdminWorkspaceProps,
    "committeeFilters"
    | "drawer"
    | "focusedCommitteeId"
  > & {
  hidden: boolean;
};

export async function CommitteeSection({
  committeeFilters,
  committeeMembers,
  drawer,
  focusedCommitteeId,
  profiles,
  hidden,
}: CommitteeSectionProps) {
  const { locale, s } = await getStaffI18n();
  const positionLabel = (member: (typeof committeeMembers)[number]) =>
    committeePositionLabel(s.setup.positions, member.position_code, member.position_title);
  const committeeTableFilters: Required<CommitteeTableFilters> = {
    dir: committeeFilters?.dir ?? "asc",
    memberName: committeeFilters?.memberName ?? "",
    page: tablePage(committeeFilters?.page),
    perPage: tablePerPage(committeeFilters?.perPage),
    position: committeeFilters?.position ?? "",
    sort: committeeFilters?.sort ?? "name",
    status: committeeFilters?.status ?? "all",
  };
  const filteredCommitteeMembers = committeeMembers.filter((member) => {
    const nameQuery = committeeTableFilters.memberName.trim().toLowerCase();
    // Position filter is a built-in code (D026).
    const positionQuery = committeeTableFilters.position.trim();
    const status = member.active ? "active" : "inactive";
    const matchesName = nameQuery
      ? member.full_name.toLowerCase().includes(nameQuery)
      : true;
    const matchesPosition = positionQuery
      ? member.position_code === positionQuery
      : true;
    const matchesStatus =
      committeeTableFilters.status === "all"
        ? true
        : status === committeeTableFilters.status;

    return matchesName && matchesPosition && matchesStatus;
  });
  const statusRank = (member: (typeof committeeMembers)[number]) => (member.active ? 0 : 1);
  const sortedCommitteeMembers = [...filteredCommitteeMembers].sort(
    (left, right) => {
      const direction = committeeTableFilters.dir === "asc" ? 1 : -1;
      const byName = left.full_name.localeCompare(right.full_name);
      const compared =
        committeeTableFilters.sort === "position"
          ? committeePositionRank(left.position_code) - committeePositionRank(right.position_code) ||
            positionLabel(left).localeCompare(positionLabel(right))
          : committeeTableFilters.sort === "status"
            ? statusRank(left) - statusRank(right)
            : byName;

      return (compared || byName) * direction;
    },
  );
  const committeeTotal = sortedCommitteeMembers.length;
  const committeeTotalPages = Math.max(
    1,
    Math.ceil(committeeTotal / committeeTableFilters.perPage),
  );
  const committeePage = Math.min(
    committeeTableFilters.page,
    committeeTotalPages,
  );
  const committeePageStart =
    committeeTotal === 0
      ? 0
      : (committeePage - 1) * committeeTableFilters.perPage + 1;
  const committeePageEnd = Math.min(
    committeePage * committeeTableFilters.perPage,
    committeeTotal,
  );
  const pagedCommitteeMembers = sortedCommitteeMembers.slice(
    (committeePage - 1) * committeeTableFilters.perPage,
    committeePage * committeeTableFilters.perPage,
  );
  const committeeListHref = committeeHref(committeeTableFilters);
  const committeeFocusId =
    drawer?.mode === "edit" && drawer.type === "committee_member"
      ? drawer.id
      : focusedCommitteeId;
  const committeePageUrls = Object.fromEntries(
    Array.from({ length: committeeTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        committeeHref({ ...committeeTableFilters, page: pageNumber }),
      ],
    ),
  );
  const committeePerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      committeeHref({ ...committeeTableFilters, page: 1, perPage }),
    ]),
  );
  const committeeSortHref = (sort: Required<CommitteeTableFilters>["sort"]) =>
    committeeHref({
      ...committeeTableFilters,
      dir:
        committeeTableFilters.sort === sort && committeeTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const committeeSortLabel = (sort: Required<CommitteeTableFilters>["sort"]) =>
    committeeTableFilters.sort === sort
      ? committeeTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const termDate = (value: string | null) =>
    value ? formatDateIn(locale, `${value}T00:00:00+07:00`) : null;
  const rows: CommitteeRow[] = pagedCommitteeMembers.map((member) => ({
    id: member.id,
    name: member.full_name,
    position: positionLabel(member),
    term: fill(s.setup.termRange, {
      start: termDate(member.term_starts_at) ?? s.common.notSet,
      end: termDate(member.term_ends_at) ?? s.common.current,
    }),
    active: member.active,
    focused: committeeFocusId === member.id,
    editHref: committeeDrawerHref(committeeListHref, { id: member.id, mode: "edit" }),
  }));
  const sortLink = (sort: Required<CommitteeTableFilters>["sort"], label: string) => (
    <a className="inline-flex min-h-11 items-center" href={committeeSortHref(sort)}>
      {label}
      {committeeSortLabel(sort)}
    </a>
  );
  const selectedCommitteeMember = committeeMembers.find(
    (member) => member.id === drawer?.id,
  );
  const showCommitteeMemberDrawer =
    drawer?.type === "committee_member" &&
    (drawer.mode === "create" ||
      (drawer.mode === "edit" && Boolean(selectedCommitteeMember)));

  return (
    <section
      className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.setup.committeeTitle}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.setup.committeeIntro}
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href={committeeDrawerHref(committeeListHref, { mode: "create" })}
        >
          {s.setup.addMember}
        </a>
      </div>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.setup.committeeFilter}
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input name="tab" type="hidden" value="committee" />
          <input
            name="sort"
            type="hidden"
            value={committeeTableFilters.sort}
          />
          <input name="dir" type="hidden" value={committeeTableFilters.dir} />
          <input
            name="perPage"
            type="hidden"
            value={committeeTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.name}
            <input
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={committeeTableFilters.memberName}
              name="memberName"
              placeholder={s.setup.searchName}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.position}
            <select
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={committeeTableFilters.position}
              name="position"
            >
              <option value="">{s.setup.allPositions}</option>
              {COMMITTEE_POSITION_CODES.map((code) => (
                <option key={code} value={code}>
                  {s.setup.positions[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.common.status}
            <select
              className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={committeeTableFilters.status}
              name="status"
            >
              <option value="all">{s.common.allStatuses}</option>
              <option value="active">{s.common.active}</option>
              <option value="inactive">{s.common.inactive}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
            <button
              className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              {s.common.search}
            </button>
            <a
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
              href="/admin/setup?tab=committee"
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
            {fill(s.common.showing, { start: committeePageStart, end: committeePageEnd, total: committeeTotal })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label={s.common.page}
            options={Array.from(
              { length: committeeTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={committeePageUrls}
            value={committeePage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            {fill(s.common.ofPages, { total: committeeTotalPages })}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label={s.common.perPage}
            urlByValue={committeePerPageUrls}
            value={committeeTableFilters.perPage}
          />
        </div>
      </div>
      <CommitteeRows rows={rows} s={s} sortLink={sortLink} />
      <CommitteeRowFocus memberId={committeeFocusId} />
      {pagedCommitteeMembers.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {s.setup.noMembers}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={committeePage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            committeePage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={committeeHref({
            ...committeeTableFilters,
            page: Math.max(1, committeePage - 1),
          })}
        >
          {s.common.previous}
        </a>
        <div className="text-sm text-[var(--muted)]">
          {committeePageStart}-{committeePageEnd} / {committeeTotal}
        </div>
        <a
          aria-disabled={committeePage >= committeeTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            committeePage >= committeeTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={committeeHref({
            ...committeeTableFilters,
            page: Math.min(committeeTotalPages, committeePage + 1),
          })}
        >
          {s.common.next}
        </a>
      </div>
      {showCommitteeMemberDrawer ? (
        <CommitteeCrudDrawer
          closeHref={committeeListHref}
          member={selectedCommitteeMember}
          mode={drawer?.mode === "edit" ? "edit" : "create"}
          profiles={profiles}
        />
      ) : null}
    </section>
  );
}
