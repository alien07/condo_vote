"use client";

import { useStaffText } from "@/lib/i18n/staff/client";
import { codeLabel, fill } from "@/lib/i18n/template";
import Link from "next/link";
import { UsersRound } from "lucide-react";
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
  listRowButtonClass,
  listRowClass,
  listTableClass,
  listTdClass,
  listThClass,
  listTheadClass,
} from "@/features/admin/components/list/admin-list";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { mergeParams, profileTableParams, profileTableStateFromParams } from "@/features/admin/components/sections/people/people-table-state";
import {
  PROFILE_APPROVAL_FILTERS,
  type PeopleCrudPilotProps,
  type ProfileTableState,
} from "@/features/admin/components/sections/people/people-types";

// Approval status as a colour badge (req_0004): waiting stands out.
const APPROVAL_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};
import { ProfileAccessForm } from "@/features/admin/components/sections/people/profile-access-form";

type ProfilesPanelProps = Pick<
  PeopleCrudPilotProps,
  "activeSection" | "appRolesByProfile" | "drawer" | "profiles"
>;

export function ProfilesPanel({
  activeSection,
  appRolesByProfile,
  drawer,
  profiles,
}: ProfilesPanelProps) {
  const { s } = useStaffText();
  const searchParams = useSearchParams();
  const [profileCriteria, setProfileCriteria] = useState(() =>
    profileTableStateFromParams(searchParams),
  );
  const [profileTableState, setProfileTableState] = useState(() =>
    profileTableStateFromParams(searchParams),
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
  const updateProfileTable = (nextState: ProfileTableState) => {
    setProfileTableState(nextState);
    setProfileCriteria(nextState);
    window.history.replaceState(
      null,
      "",
      mergeParams(searchParams, {
        ...profileTableParams(nextState),
        tab: "profiles",
      }),
    );
  };
  const selectedProfile = profiles.find((profile) => profile.id === drawer?.id);
  const drawerContent = useMemo(() => {
    if (
      (activeSection === "rooms" && drawer?.type !== "room") ||
      (activeSection === "owners" && drawer?.type !== "owner") ||
      (activeSection === "profiles" && drawer?.type !== "profile")
    ) {
      return null;
    }

    if (drawer?.mode === "edit" && drawer.type === "profile" && selectedProfile) {
      return {
        content: (
          <ProfileAccessForm
            appRoles={appRolesByProfile.get(selectedProfile.id) ?? []}
            closeHref={closeHref}
            profile={selectedProfile}
          />
        ),
        summary: [
          fill(s.people.nameSummary, { name: selectedProfile.full_name }),
          fill(s.people.emailSummary, { email: selectedProfile.email }),
          fill(s.people.profileStatusSummary, {
            defaultStatus: codeLabel(s.common.code, selectedProfile.default_status),
            approvalStatus: codeLabel(s.common.code, selectedProfile.approval_status),
          }),
        ],
        title: s.people.editAccess,
      };
    }

    return null;
  }, [
    s,
    activeSection,
    appRolesByProfile,
    closeHref,
    drawer?.mode,
    drawer?.type,
    selectedProfile,
  ]);
  const filteredProfiles = useMemo(() => {
    const nameQuery = profileTableState.name.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesName = nameQuery
        ? [profile.full_name, profile.email]
            .join(" ")
            .toLowerCase()
            .includes(nameQuery)
        : true;
      const matchesDefaultStatus =
        profileTableState.defaultStatus === "all"
          ? true
          : profile.default_status === profileTableState.defaultStatus;
      const matchesApproval =
        profileTableState.approval === "all" || profile.approval_status === profileTableState.approval;

      return matchesName && matchesDefaultStatus && matchesApproval;
    });
  }, [profileTableState.approval, profileTableState.defaultStatus, profileTableState.name, profiles]);
  const sortedProfiles = useMemo(() => {
    const direction = profileTableState.dir === "asc" ? 1 : -1;

    return [...filteredProfiles].sort((left, right) => {
      const leftValue =
        profileTableState.sort === "default_status"
          ? left.default_status
          : left.full_name;
      const rightValue =
        profileTableState.sort === "default_status"
          ? right.default_status
          : right.full_name;

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [filteredProfiles, profileTableState.dir, profileTableState.sort]);
  const profileTotal = sortedProfiles.length;
  const profileTotalPages = Math.max(
    1,
    Math.ceil(profileTotal / profileTableState.perPage),
  );
  const profilePage = Math.min(profileTableState.page, profileTotalPages);
  const profilePageStart =
    profileTotal === 0 ? 0 : (profilePage - 1) * profileTableState.perPage + 1;
  const profilePageEnd = Math.min(
    profilePage * profileTableState.perPage,
    profileTotal,
  );
  const pagedProfiles = sortedProfiles.slice(
    (profilePage - 1) * profileTableState.perPage,
    profilePage * profileTableState.perPage,
  );

  const sortBy = (sort: ProfileTableState["sort"]) =>
    updateProfileTable({
      ...profileTableState,
      dir: profileTableState.sort === sort && profileTableState.dir === "asc" ? "desc" : "asc",
      page: 1,
      sort,
    });
  const clearProfileTable = () =>
    updateProfileTable({
      approval: "all",
      defaultStatus: "all",
      dir: "asc",
      name: "",
      page: 1,
      perPage: 25,
      sort: "name",
    });
  const approvalLabel: Record<ProfileTableState["approval"], string> = {
    all: s.common.allStatuses,
    pending: s.people.pendingOption,
    approved: s.people.approvedOption,
    rejected: s.people.rejectedOption,
  };
  const defaultStatusLabel: Record<ProfileTableState["defaultStatus"], string> = {
    all: s.common.allStatuses,
    owner: s.people.ownerOption,
    proxy: s.people.proxyOption,
    resident: s.people.residentOption,
  };
  // Search feedback: the count, the filters in use, and a fade on every
  // search (even a repeated one, hence searchRuns).
  const profileFilters = [
    ...(profileTableState.name.trim()
      ? [
          {
            key: "name",
            label: `${s.common.name}: ${profileTableState.name.trim()}`,
            onRemove: () => updateProfileTable({ ...profileTableState, name: "", page: 1 }),
          },
        ]
      : []),
    ...(profileTableState.defaultStatus !== "all"
      ? [
          {
            key: "defaultStatus",
            label: `${s.people.defaultStatus}: ${defaultStatusLabel[profileTableState.defaultStatus]}`,
            onRemove: () =>
              updateProfileTable({ ...profileTableState, defaultStatus: "all", page: 1 }),
          },
        ]
      : []),
    ...(profileTableState.approval !== "all"
      ? [
          {
            key: "approval",
            label: `${s.people.approvalStatus}: ${approvalLabel[profileTableState.approval]}`,
            onRemove: () => updateProfileTable({ ...profileTableState, approval: "all", page: 1 }),
          },
        ]
      : []),
  ];
  const profileShowing = fill(s.common.showing, {
    start: profilePageStart,
    end: profilePageEnd,
    total: profileTotal,
  });
  const profileFound = fill(s.common.foundOf, {
    count: profileTotal,
    total: profiles.length,
  });
  const profileMeta = !profileFilters.length
    ? profileShowing
    : profileTotal
      ? `${profileFound} · ${profileShowing}`
      : profileFound;

  return (
    <>
      <AdminListCard
        footer={
          <AdminListFooterPager
            end={profilePageEnd}
            onPage={(page) => updateProfileTable({ ...profileTableState, page })}
            page={profilePage}
            start={profilePageStart}
            total={profileTotal}
            totalPages={profileTotalPages}
          />
        }
        filters={profileFilters}
        icon={<UsersRound aria-hidden="true" size={20} />}
        meta={profileMeta}
        pager={
          <AdminListPager
            onPage={(page) => updateProfileTable({ ...profileTableState, page })}
            onPerPage={(perPage) => updateProfileTable({ ...profileTableState, page: 1, perPage })}
            page={profilePage}
            perPage={profileTableState.perPage}
            totalPages={profileTotalPages}
          />
        }
        resultKey={`${JSON.stringify(profileTableState)}:${searchRuns}`}
        title={s.people.profilesTitle}
        toolbar={
          <AdminListToolbar
            onClear={clearProfileTable}
            onSubmit={() => {
              setSearchRuns((runs) => runs + 1);
              updateProfileTable({ ...profileCriteria, page: 1 });
            }}
          >
            <label className={`${listFieldClass} w-full sm:w-72`}>
              {s.common.name}
              <input
                className={listInputClass}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setProfileCriteria((current) => ({ ...current, name: value }));
                }}
                placeholder={s.people.searchProfile}
                value={profileCriteria.name}
              />
            </label>
            <label className={`${listFieldClass} w-full sm:w-44`}>
              {s.people.defaultStatus}
              <select
                className={listInputClass}
                onChange={(event) => {
                  const value = event.currentTarget.value as ProfileTableState["defaultStatus"];

                  setProfileCriteria((current) => ({ ...current, defaultStatus: value }));
                }}
                value={profileCriteria.defaultStatus}
              >
                <option value="all">{s.common.allStatuses}</option>
                <option value="owner">{s.people.ownerOption}</option>
                <option value="resident">{s.people.residentOption}</option>
                <option value="proxy">{s.people.proxyOption}</option>
              </select>
            </label>
            <label className={`${listFieldClass} w-full sm:w-44`}>
              {s.people.approvalStatus}
              <select
                className={listInputClass}
                name="approval"
                onChange={(event) => {
                  const value = event.currentTarget.value as ProfileTableState["approval"];

                  setProfileCriteria((current) => ({ ...current, approval: value }));
                }}
                value={profileCriteria.approval}
              >
                {PROFILE_APPROVAL_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {approvalLabel[value]}
                  </option>
                ))}
              </select>
            </label>
          </AdminListToolbar>
        }
      >
        <table className={listTableClass}>
          <thead className={listTheadClass}>
            <tr>
              <SortHeader
                active={profileTableState.sort === "name"}
                dir={profileTableState.dir}
                label={s.common.name}
                onSort={() => sortBy("name")}
              />
              <th className={listThClass} scope="col">{s.people.email}</th>
              <SortHeader
                active={profileTableState.sort === "default_status"}
                dir={profileTableState.dir}
                label={s.people.defaultStatus}
                onSort={() => sortBy("default_status")}
              />
              <th className={listThClass} scope="col">{s.people.approval}</th>
              <th className={listThClass} scope="col">{s.people.roles}</th>
              <th className={listThClass} scope="col">{s.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {pagedProfiles.map((profile) => {
              const profileRoles = appRolesByProfile.get(profile.id) ?? [];
              const selected =
                drawer?.mode === "edit" &&
                drawer.type === "profile" &&
                drawer.id === profile.id;

              return (
                <tr
                  className={[
                    listRowClass,
                    selected ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]" : "",
                  ].join(" ")}
                  key={profile.id}
                >
                  <td className={`${listTdClass} font-medium`}>{profile.full_name}</td>
                  <td className={listTdClass}>{profile.email}</td>
                  <td className={listTdClass}>{codeLabel(s.common.code, profile.default_status)}</td>
                  <td className={listTdClass}>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        APPROVAL_BADGE[profile.approval_status] ?? "bg-slate-100 text-slate-700"
                      }`}
                      data-approval={profile.approval_status}
                    >
                      {approvalLabel[profile.approval_status as ProfileTableState["approval"]] ??
                        codeLabel(s.common.code, profile.approval_status)}
                    </span>
                  </td>
                  <td className={listTdClass}>
                    {profileRoles.map((role) => codeLabel(s.common.code, role.role)).join(", ") || "-"}
                  </td>
                  <td className={listTdClass}>
                    <div className={listActionsClass}>
                      <Link
                        className={listRowButtonClass}
                        href={buildHref({
                          id: profile.id,
                          mode: "edit",
                          tab: "profiles",
                          type: "profile",
                        })}
                      >
                        {s.people.editAccess}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagedProfiles.length === 0 ? (
          <AdminListEmpty
            message={s.people.noProfiles}
            onClearFilters={profileFilters.length ? clearProfileTable : undefined}
          />
        ) : null}
      </AdminListCard>
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
