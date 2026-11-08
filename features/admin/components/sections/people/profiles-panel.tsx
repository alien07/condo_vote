"use client";

import Link from "next/link";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { mergeParams, profileTableParams, profileTableStateFromParams } from "@/features/admin/components/sections/people/people-table-state";
import type { PeopleCrudPilotProps, ProfileTableState } from "@/features/admin/components/sections/people/people-types";
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
  const searchParams = useSearchParams();
  const [profileCriteria, setProfileCriteria] = useState(() =>
    profileTableStateFromParams(searchParams),
  );
  const [profileTableState, setProfileTableState] = useState(() =>
    profileTableStateFromParams(searchParams),
  );
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
          `Name: ${selectedProfile.full_name}`,
          `Email: ${selectedProfile.email}`,
          `Status: ${selectedProfile.default_status} / ${selectedProfile.approval_status}`,
        ],
        title: "Edit roles/status",
      };
    }

    return null;
  }, [
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

      return matchesName && matchesDefaultStatus;
    });
  }, [profileTableState.defaultStatus, profileTableState.name, profiles]);
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

  return (
    <>
      <div className="grid gap-5">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Search Criteria</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Filter profiles by name, email, and default status.
            </p>
          </div>
          <form
            className="grid gap-3 md:grid-cols-12"
            onSubmit={(event) => {
              event.preventDefault();
              updateProfileTable({ ...profileCriteria, page: 1 });
            }}
          >
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-5">
              Name
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setProfileCriteria((current) => ({
                    ...current,
                    name: value,
                  }));
                }}
                placeholder="Search profile name or email"
                value={profileCriteria.name}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
              Default status
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget
                    .value as ProfileTableState["defaultStatus"];

                  setProfileCriteria((current) => ({
                    ...current,
                    defaultStatus: value,
                  }));
                }}
                value={profileCriteria.defaultStatus}
              >
                <option value="all">All statuses</option>
                <option value="owner">Owner</option>
                <option value="resident">Resident</option>
                <option value="proxy">Proxy</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-4">
              <button
                className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                type="submit"
              >
                Search
              </button>
              <button
                className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                onClick={() =>
                  updateProfileTable({
                    defaultStatus: "all",
                    dir: "asc",
                    name: "",
                    page: 1,
                    perPage: 25,
                    sort: "name",
                  })
                }
                type="button"
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">Registered Profiles</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {profilePageStart}-{profilePageEnd} of {profileTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <span>Page</span>
                <select
                  aria-label="Page"
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                  disabled={profileTotalPages <= 1}
                  onChange={(event) => {
                    const nextPage = Number(event.currentTarget.value);

                    updateProfileTable({
                      ...profileTableState,
                      page:
                        Number.isInteger(nextPage) && nextPage > 0
                          ? nextPage
                          : 1,
                    });
                  }}
                  value={String(profilePage)}
                >
                  {Array.from(
                    { length: profileTotalPages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {pageNumber}
                    </option>
                  ))}
                </select>
                <span>of {profileTotalPages}</span>
              </label>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <span>Per page</span>
                <select
                  aria-label="Per page"
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                  onChange={(event) => {
                    const nextPerPage = Number(event.currentTarget.value);

                    updateProfileTable({
                      ...profileTableState,
                      page: 1,
                      perPage: Number.isInteger(nextPerPage)
                        ? nextPerPage
                        : 25,
                    });
                  }}
                  value={String(profileTableState.perPage)}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto px-5 pb-2">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">
                  <button
                    className="font-medium"
                    onClick={() =>
                      updateProfileTable({
                        ...profileTableState,
                        dir:
                          profileTableState.sort === "name" &&
                          profileTableState.dir === "asc"
                            ? "desc"
                            : "asc",
                        page: 1,
                        sort: "name",
                      })
                    }
                    type="button"
                  >
                    Name
                    {profileTableState.sort === "name"
                      ? profileTableState.dir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                </th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">
                  <button
                    className="font-medium"
                    onClick={() =>
                      updateProfileTable({
                        ...profileTableState,
                        dir:
                          profileTableState.sort === "default_status" &&
                          profileTableState.dir === "asc"
                            ? "desc"
                            : "asc",
                        page: 1,
                        sort: "default_status",
                      })
                    }
                    type="button"
                  >
                    Default status
                    {profileTableState.sort === "default_status"
                      ? profileTableState.dir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                </th>
                <th className="py-2 pr-3 font-medium">Approval</th>
                <th className="py-2 pr-3 font-medium">Roles</th>
                <th className="py-2 font-medium">Action</th>
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
                      "border-b border-[var(--border)]",
                      selected
                        ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                        : "",
                    ].join(" ")}
                    key={profile.id}
                  >
                    <td className="py-2 pr-3">{profile.full_name}</td>
                    <td className="py-2 pr-3">{profile.email}</td>
                    <td className="py-2 pr-3">{profile.default_status}</td>
                    <td className="py-2 pr-3">{profile.approval_status}</td>
                    <td className="py-2 pr-3">
                      {profileRoles.map((role) => role.role).join(", ") || "-"}
                    </td>
                    <td className="py-2">
                      <Link
                        className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                        href={buildHref({
                          id: profile.id,
                          mode: "edit",
                          tab: "profiles",
                          type: "profile",
                        })}
                      >
                        Edit roles/status
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagedProfiles.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--muted)]">
            No profiles match the selected criteria.
          </p>
        ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={profilePage <= 1}
              onClick={() =>
                updateProfileTable({
                  ...profileTableState,
                  page: Math.max(1, profilePage - 1),
                })
              }
              type="button"
            >
              Previous
            </button>
            <div className="text-sm text-[var(--muted)]">
              {profilePageStart}-{profilePageEnd} / {profileTotal}
            </div>
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={profilePage >= profileTotalPages}
              onClick={() =>
                updateProfileTable({
                  ...profileTableState,
                  page: Math.min(profileTotalPages, profilePage + 1),
                })
              }
              type="button"
            >
              Next
            </button>
          </div>
        </section>
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
