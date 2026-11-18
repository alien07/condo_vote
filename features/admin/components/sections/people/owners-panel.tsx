"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { fill } from "@/lib/i18n/template";
import Link from "next/link";
import { History, TriangleAlert, UserRound } from "lucide-react";
import { deactivateOwner, reactivateOwner } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  AdminListCard,
  AdminListEmpty,
  AdminListFooterPager,
  AdminListPager,
  AdminListToolbar,
  SortHeader,
  listActionsClass,
  listFieldClass,
  listInputClass,
  listQuietButtonClass,
  listQuietDangerButtonClass,
  listRowButtonClass,
  listRowClass,
  listTableClass,
  listTdClass,
  listThClass,
  listTheadClass,
} from "@/features/admin/components/list/admin-list";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OwnerForm } from "@/features/admin/components/sections/people/owner-form";
import { OwnerAccountPanel } from "@/features/admin/components/sections/people/owner-account-panel";
import { OwnerAccountHistory } from "@/features/admin/components/sections/people/owner-account-history";
import { mergeParams, ownerTableParams, ownerTableStateFromParams } from "@/features/admin/components/sections/people/people-table-state";
import type { OwnerTableState, PeopleCrudPilotProps } from "@/features/admin/components/sections/people/people-types";

type OwnersPanelProps = Pick<
  PeopleCrudPilotProps,
  | "activeSection"
  | "canManageOwnerAccounts"
  | "drawer"
  | "ownerAccountEvents"
  | "owners"
  | "profiles"
>;

export function OwnersPanel({
  activeSection,
  canManageOwnerAccounts,
  drawer,
  ownerAccountEvents,
  owners,
  profiles,
}: OwnersPanelProps) {
  const { s } = useStaffText();
  const searchParams = useSearchParams();
  const [ownerCriteria, setOwnerCriteria] = useState(() =>
    ownerTableStateFromParams(searchParams),
  );
  const [ownerTableState, setOwnerTableState] = useState(() =>
    ownerTableStateFromParams(searchParams),
  );
  const [searchRuns, setSearchRuns] = useState(0);
  const closeHref = mergeParams(searchParams, {
    feedback: null,
    id: null,
    message: null,
    mode: null,
    tab: activeSection,
    type: null,
  });
  const buildHref = (updates: Record<string, string | null | undefined>) =>
    mergeParams(searchParams, updates);
  const updateOwnerTable = (nextState: OwnerTableState) => {
    setOwnerTableState(nextState);
    setOwnerCriteria(nextState);
    window.history.replaceState(
      null,
      "",
      mergeParams(searchParams, {
        ...ownerTableParams(nextState),
        tab: "owners",
      }),
    );
  };
  const selectedOwner = owners.find((owner) => owner.id === drawer?.id);
  const drawerContent = useMemo(() => {
    if (
      (activeSection === "rooms" && drawer?.type !== "room") ||
      (activeSection === "owners" && drawer?.type !== "owner") ||
      (activeSection === "profiles" && drawer?.type !== "profile")
    ) {
      return null;
    }

    if (drawer?.mode === "history" && drawer.type === "owner" && canManageOwnerAccounts) {
      return {
        content: (
          <OwnerAccountHistory
            buildOwnerHref={(ownerId) =>
              mergeParams(searchParams, { id: ownerId, mode: "edit", tab: "owners", type: "owner" })
            }
            events={ownerAccountEvents}
            owners={owners}
            profiles={profiles}
          />
        ),
        summary: [],
        title: s.people.accountHistory,
      };
    }

    if (drawer?.mode === "create" && drawer.type === "owner") {
      return {
        content: <OwnerForm closeHref={closeHref} mode="create" />,
        summary: [s.people.newOwner],
        title: s.people.addOwner,
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "owner" && selectedOwner) {
      return {
        content: (
          <>
            <OwnerForm
              canEditEmail={canManageOwnerAccounts}
              closeHref={closeHref}
              mode="edit"
              owner={selectedOwner}
            />
            <OwnerAccountPanel
              canManage={canManageOwnerAccounts}
              key={`${selectedOwner.id}:${selectedOwner.profile_id ?? ""}`}
              owner={selectedOwner}
              profiles={profiles}
            />
          </>
        ),
        summary: [
          fill(s.people.nameSummary, { name: selectedOwner.full_name }),
          fill(s.people.emailSummary, { email: selectedOwner.email ?? "-" }),
          fill(s.people.statusSummary, {
            status: selectedOwner.active ? s.common.active : s.common.inactive,
          }),
        ],
        title: s.people.editOwner,
      };
    }

    return null;
  }, [
    s,
    activeSection,
    canManageOwnerAccounts,
    closeHref,
    drawer?.mode,
    drawer?.type,
    ownerAccountEvents,
    owners,
    profiles,
    searchParams,
    selectedOwner,
  ]);
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );
  const filteredOwners = useMemo(() => {
    const nameQuery = ownerTableState.name.trim().toLowerCase();

    return owners.filter((owner) => {
      const matchesName = nameQuery
        ? [owner.full_name, owner.email ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(nameQuery)
        : true;
      const matchesStatus =
        ownerTableState.status === "all"
          ? true
          : ownerTableState.status === "active"
            ? Boolean(owner.active)
            : !owner.active;
      const matchesAccount =
        ownerTableState.account === "all"
          ? true
          : ownerTableState.account === "linked"
            ? Boolean(owner.profile_id)
            : !owner.profile_id;

      return matchesName && matchesStatus && matchesAccount;
    });
  }, [ownerTableState.account, ownerTableState.name, ownerTableState.status, owners]);
  // Work waiting for the admin (D024): active owners with no account.
  const unlinkedActiveCount = owners.filter((owner) => owner.active && !owner.profile_id).length;
  const sortedOwners = useMemo(() => {
    const direction = ownerTableState.dir === "asc" ? 1 : -1;

    return [...filteredOwners].sort((left, right) => {
      const leftValue =
        ownerTableState.sort === "status"
          ? left.active
            ? "active"
            : "inactive"
          : left.full_name;
      const rightValue =
        ownerTableState.sort === "status"
          ? right.active
            ? "active"
            : "inactive"
          : right.full_name;

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [filteredOwners, ownerTableState.dir, ownerTableState.sort]);
  const ownerTotal = sortedOwners.length;
  const ownerTotalPages = Math.max(
    1,
    Math.ceil(ownerTotal / ownerTableState.perPage),
  );
  const ownerPage = Math.min(ownerTableState.page, ownerTotalPages);
  const ownerPageStart =
    ownerTotal === 0 ? 0 : (ownerPage - 1) * ownerTableState.perPage + 1;
  const ownerPageEnd = Math.min(ownerPage * ownerTableState.perPage, ownerTotal);
  const pagedOwners = sortedOwners.slice(
    (ownerPage - 1) * ownerTableState.perPage,
    ownerPage * ownerTableState.perPage,
  );

  const sortBy = (sort: OwnerTableState["sort"]) =>
    updateOwnerTable({
      ...ownerTableState,
      dir: ownerTableState.sort === sort && ownerTableState.dir === "asc" ? "desc" : "asc",
      page: 1,
      sort,
    });
  const clearOwnerTable = () =>
    updateOwnerTable({
      account: "all",
      dir: "asc",
      name: "",
      page: 1,
      perPage: 25,
      sort: "name",
      status: "all",
    });
  // Search feedback: the count, the filters in use, and a fade on every
  // search (even a repeated one, hence searchRuns).
  const ownerFilters = [
    ...(ownerTableState.name.trim()
      ? [
          {
            key: "name",
            label: `${s.common.name}: ${ownerTableState.name.trim()}`,
            onRemove: () => updateOwnerTable({ ...ownerTableState, name: "", page: 1 }),
          },
        ]
      : []),
    ...(ownerTableState.status !== "all"
      ? [
          {
            key: "status",
            label: `${s.common.status}: ${
              ownerTableState.status === "active" ? s.common.active : s.common.inactive
            }`,
            onRemove: () => updateOwnerTable({ ...ownerTableState, page: 1, status: "all" }),
          },
        ]
      : []),
    ...(ownerTableState.account !== "all"
      ? [
          {
            key: "account",
            label: `${s.people.account}: ${
              ownerTableState.account === "linked"
                ? s.people.accountLinkedFilter
                : s.people.accountNotLinked
            }`,
            onRemove: () => updateOwnerTable({ ...ownerTableState, account: "all", page: 1 }),
          },
        ]
      : []),
  ];
  const showUnlinkedOwners = () =>
    updateOwnerTable({ ...ownerTableState, account: "unlinked", page: 1, status: "active" });
  const ownerShowing = fill(s.common.showing, {
    start: ownerPageStart,
    end: ownerPageEnd,
    total: ownerTotal,
  });
  const ownerFound = fill(s.common.foundOf, { count: ownerTotal, total: owners.length });
  const ownerMeta = !ownerFilters.length
    ? ownerShowing
    : ownerTotal
      ? `${ownerFound} · ${ownerShowing}`
      : ownerFound;

  return (
    <>
      <div className="grid gap-5">
        {canManageOwnerAccounts && unlinkedActiveCount > 0 ? (
          // Work waiting for the admin sits above the list, not below it
          // (2026-11-17), so it is seen without scrolling.
          <div
            className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--warning)]"
            role="status"
          >
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert aria-hidden="true" size={18} />
              {fill(s.people.accountUnlinkedCount, { count: unlinkedActiveCount })}
            </p>
            {ownerTableState.account === "unlinked" ? null : (
              <button
                className="min-h-9 rounded-md border border-[var(--warning-border)] bg-[var(--surface)] px-3 font-medium"
                onClick={showUnlinkedOwners}
                type="button"
              >
                {s.people.accountShowUnlinked}
              </button>
            )}
          </div>
        ) : null}
        <AdminListCard
          actions={
            <>
              {canManageOwnerAccounts ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                  href={buildHref({ id: null, mode: "history", tab: "owners", type: "owner" })}
                >
                  <History aria-hidden="true" size={16} />
                  {s.people.accountHistory}
                </Link>
              ) : null}
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                href={buildHref({ mode: "create", tab: "owners", type: "owner" })}
              >
                {s.people.addOwner}
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                href="/admin/people/import"
              >
                {s.people.importMaster}
              </Link>
            </>
          }
          description={s.people.ownersIntro}
          footer={
            <AdminListFooterPager
              end={ownerPageEnd}
              onPage={(page) => updateOwnerTable({ ...ownerTableState, page })}
              page={ownerPage}
              start={ownerPageStart}
              total={ownerTotal}
              totalPages={ownerTotalPages}
            />
          }
          filters={ownerFilters}
          icon={<UserRound aria-hidden="true" size={20} />}
          meta={ownerMeta}
          pager={
            <AdminListPager
              onPage={(page) => updateOwnerTable({ ...ownerTableState, page })}
              onPerPage={(perPage) => updateOwnerTable({ ...ownerTableState, page: 1, perPage })}
              page={ownerPage}
              perPage={ownerTableState.perPage}
              totalPages={ownerTotalPages}
            />
          }
          resultKey={`${JSON.stringify(ownerTableState)}:${searchRuns}`}
          title={s.people.owners}
          toolbar={
            <AdminListToolbar
              onClear={clearOwnerTable}
              onSubmit={() => {
                setSearchRuns((runs) => runs + 1);
                updateOwnerTable({ ...ownerCriteria, page: 1 });
              }}
            >
              <label className={`${listFieldClass} w-full sm:w-72`}>
                {s.common.name}
                <input
                  className={listInputClass}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    setOwnerCriteria((current) => ({ ...current, name: value }));
                  }}
                  placeholder={s.people.searchOwner}
                  value={ownerCriteria.name}
                />
              </label>
              <label className={`${listFieldClass} w-full sm:w-44`}>
                {s.common.status}
                <select
                  className={listInputClass}
                  onChange={(event) => {
                    const value = event.currentTarget.value as OwnerTableState["status"];

                    setOwnerCriteria((current) => ({ ...current, status: value }));
                  }}
                  value={ownerCriteria.status}
                >
                  <option value="all">{s.common.allStatuses}</option>
                  <option value="active">{s.common.active}</option>
                  <option value="inactive">{s.common.inactive}</option>
                </select>
              </label>
              <label className={`${listFieldClass} w-full sm:w-44`}>
                {s.people.account}
                <select
                  className={listInputClass}
                  onChange={(event) => {
                    const value = event.currentTarget.value as OwnerTableState["account"];

                    setOwnerCriteria((current) => ({ ...current, account: value }));
                  }}
                  value={ownerCriteria.account}
                >
                  <option value="all">{s.people.accountAll}</option>
                  <option value="linked">{s.people.accountLinkedFilter}</option>
                  <option value="unlinked">{s.people.accountNotLinked}</option>
                </select>
              </label>
            </AdminListToolbar>
          }
        >
          <table className={listTableClass}>
            <thead className={listTheadClass}>
              <tr>
                <SortHeader
                  active={ownerTableState.sort === "name"}
                  dir={ownerTableState.dir}
                  label={s.common.name}
                  onSort={() => sortBy("name")}
                />
                <th className={listThClass} scope="col">{s.people.email}</th>
                <th className={listThClass} scope="col">{s.people.account}</th>
                <SortHeader
                  active={ownerTableState.sort === "status"}
                  dir={ownerTableState.dir}
                  label={s.common.status}
                  onSort={() => sortBy("status")}
                />
                <th className={listThClass} scope="col">{s.common.action}</th>
              </tr>
            </thead>
            <tbody>
              {pagedOwners.map((owner) => {
                const selected =
                  drawer?.mode === "edit" &&
                  drawer.type === "owner" &&
                  drawer.id === owner.id;

                return (
                  <tr
                    className={[
                      listRowClass,
                      selected ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]" : "",
                    ].join(" ")}
                    key={owner.id}
                  >
                    <td className={`${listTdClass} font-medium`}>{owner.full_name}</td>
                    <td className={listTdClass}>{owner.email ?? "-"}</td>
                    <td className={listTdClass}>
                      {owner.profile_id ? (
                        profileEmailById.get(owner.profile_id) ?? "-"
                      ) : (
                        <span className="inline-flex rounded-full border border-[var(--warning-border)] bg-[var(--warning-surface)] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[var(--warning)]">
                          {s.people.accountNotLinked}
                        </span>
                      )}
                    </td>
                    <td className={listTdClass}>
                      {owner.active ? s.common.active : s.common.inactive}
                    </td>
                    <td className={listTdClass}>
                      <div className={listActionsClass}>
                        <Link
                          className={listRowButtonClass}
                          href={buildHref({
                            id: owner.id,
                            mode: "edit",
                            tab: "owners",
                            type: "owner",
                          })}
                        >
                          {s.common.edit}
                        </Link>
                        <form action={owner.active ? deactivateOwner : reactivateOwner}>
                          <input name="id" type="hidden" value={owner.id} />
                          <ConfirmSubmitButton
                            className={owner.active ? listQuietDangerButtonClass : listQuietButtonClass}
                            confirmMessage={
                              owner.active
                                ? fill(s.people.confirmDeactivateOwner, { name: owner.full_name })
                                : fill(s.people.confirmReactivateOwner, { name: owner.full_name })
                            }
                            pendingLabel={
                              owner.active ? s.common.deactivating : s.common.reactivating
                            }
                            type="submit"
                          >
                            {owner.active ? s.common.deactivate : s.common.reactivate}
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pagedOwners.length === 0 ? (
            <AdminListEmpty
              message={s.people.noOwners}
              onClearFilters={ownerFilters.length ? clearOwnerTable : undefined}
            />
          ) : null}
        </AdminListCard>
      </div>

      {drawerContent ? (
        <AdminCrudDrawer
          closeHref={closeHref}
          summary={drawerContent.summary}
          title={drawerContent.title}
        >
          {drawerContent.content}
        </AdminCrudDrawer>
      ) : null}
    </>
  );
}
