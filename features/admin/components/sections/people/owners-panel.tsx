"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { deactivateOwner, reactivateOwner } from "@/features/admin/actions";
import { ConfirmSubmitButton } from "@/features/admin/components/form-controls";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OwnerForm } from "@/features/admin/components/sections/people/owner-form";
import { mergeParams, ownerTableParams, ownerTableStateFromParams } from "@/features/admin/components/sections/people/people-table-state";
import type { OwnerTableState, PeopleCrudPilotProps } from "@/features/admin/components/sections/people/people-types";

type OwnersPanelProps = Pick<
  PeopleCrudPilotProps,
  "activeSection" | "drawer" | "owners"
>;

export function OwnersPanel({
  activeSection,
  drawer,
  owners,
}: OwnersPanelProps) {
  const searchParams = useSearchParams();
  const [ownerCriteria, setOwnerCriteria] = useState(() =>
    ownerTableStateFromParams(searchParams),
  );
  const [ownerTableState, setOwnerTableState] = useState(() =>
    ownerTableStateFromParams(searchParams),
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

    if (drawer?.mode === "create" && drawer.type === "owner") {
      return {
        content: <OwnerForm closeHref={closeHref} mode="create" />,
        summary: ["New owner record"],
        title: "Add owner",
      };
    }

    if (drawer?.mode === "edit" && drawer.type === "owner" && selectedOwner) {
      return {
        content: (
          <OwnerForm closeHref={closeHref} mode="edit" owner={selectedOwner} />
        ),
        summary: [
          `Name: ${selectedOwner.full_name}`,
          `Email: ${selectedOwner.email ?? "-"}`,
          `Status: ${selectedOwner.active ? "Active" : "Inactive"}`,
        ],
        title: "Edit owner",
      };
    }

    return null;
  }, [
    activeSection,
    closeHref,
    drawer?.mode,
    drawer?.type,
    selectedOwner,
  ]);
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

      return matchesName && matchesStatus;
    });
  }, [ownerTableState.name, ownerTableState.status, owners]);
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

  return (
    <>
      <div className="grid gap-5">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold">Owners Master Data</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Maintain owner records used for room ownership links and voting
                eligibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                href={buildHref({ mode: "create", tab: "owners", type: "owner" })}
              >
                Add owner
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
                href="/admin/people/import"
              >
                Import Master Data
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Search Criteria</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Filter owners by name, email, and active status.
            </p>
          </div>
          <form
            className="grid gap-3 md:grid-cols-12"
            onSubmit={(event) => {
              event.preventDefault();
              updateOwnerTable({ ...ownerCriteria, page: 1 });
            }}
          >
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-5">
              Name
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setOwnerCriteria((current) => ({ ...current, name: value }));
                }}
                placeholder="Search owner name or email"
                value={ownerCriteria.name}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
              Status
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                onChange={(event) => {
                  const value = event.currentTarget
                    .value as OwnerTableState["status"];

                  setOwnerCriteria((current) => ({ ...current, status: value }));
                }}
                value={ownerCriteria.status}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
                  updateOwnerTable({
                    dir: "asc",
                    name: "",
                    page: 1,
                    perPage: 25,
                    sort: "name",
                    status: "all",
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
          <div className="mb-4 flex items-center gap-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <UserRound className="text-[var(--primary)]" size={20} />
                <div>
                  <h2 className="text-lg font-semibold">Owners</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Showing {ownerPageStart}-{ownerPageEnd} of {ownerTotal}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                  <span>Page</span>
                  <select
                    aria-label="Page"
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                    disabled={ownerTotalPages <= 1}
                    onChange={(event) => {
                      const nextPage = Number(event.currentTarget.value);

                      updateOwnerTable({
                        ...ownerTableState,
                        page:
                          Number.isInteger(nextPage) && nextPage > 0
                            ? nextPage
                            : 1,
                      });
                    }}
                    value={String(ownerPage)}
                  >
                    {Array.from(
                      { length: ownerTotalPages },
                      (_, index) => index + 1,
                    ).map((pageNumber) => (
                      <option key={pageNumber} value={pageNumber}>
                        {pageNumber}
                      </option>
                    ))}
                  </select>
                  <span>of {ownerTotalPages}</span>
                </label>
                <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                  <span>Per page</span>
                  <select
                    aria-label="Per page"
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)]"
                    onChange={(event) => {
                      const nextPerPage = Number(event.currentTarget.value);

                      updateOwnerTable({
                        ...ownerTableState,
                        page: 1,
                        perPage: Number.isInteger(nextPerPage)
                          ? nextPerPage
                          : 25,
                      });
                    }}
                    value={String(ownerTableState.perPage)}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </label>
              </div>
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
                        updateOwnerTable({
                          ...ownerTableState,
                          dir:
                            ownerTableState.sort === "name" &&
                            ownerTableState.dir === "asc"
                              ? "desc"
                              : "asc",
                          page: 1,
                          sort: "name",
                        })
                      }
                      type="button"
                    >
                      Name
                      {ownerTableState.sort === "name"
                        ? ownerTableState.dir === "asc"
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
                        updateOwnerTable({
                          ...ownerTableState,
                          dir:
                            ownerTableState.sort === "status" &&
                            ownerTableState.dir === "asc"
                              ? "desc"
                              : "asc",
                          page: 1,
                          sort: "status",
                        })
                      }
                      type="button"
                    >
                      Status
                      {ownerTableState.sort === "status"
                        ? ownerTableState.dir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                  <th className="py-2 font-medium">Action</th>
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
                        "border-b border-[var(--border)]",
                        selected
                          ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                          : "",
                      ].join(" ")}
                      key={owner.id}
                    >
                      <td className="py-2 pr-3">{owner.full_name}</td>
                      <td className="py-2 pr-3">{owner.email ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {owner.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                            href={buildHref({
                              id: owner.id,
                              mode: "edit",
                              tab: "owners",
                              type: "owner",
                            })}
                          >
                            Edit
                          </Link>
                          <form
                            action={
                              owner.active ? deactivateOwner : reactivateOwner
                            }
                          >
                            <input name="id" type="hidden" value={owner.id} />
                            <ConfirmSubmitButton
                              className={
                                owner.active
                                  ? "text-sm font-medium text-red-700"
                                  : "text-sm font-medium text-[var(--primary)]"
                              }
                              confirmMessage={
                                owner.active
                                  ? `Deactivate owner "${owner.full_name}"? This owner will no longer be available for new active room ownership links.`
                                  : `Reactivate owner "${owner.full_name}"? This owner will become available for room ownership links.`
                              }
                              pendingLabel={
                                owner.active
                                  ? "Deactivating..."
                                  : "Reactivating..."
                              }
                              type="submit"
                            >
                              {owner.active ? "Deactivate" : "Reactivate"}
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pagedOwners.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[var(--muted)]">
              No owners match the selected criteria.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={ownerPage <= 1}
              onClick={() =>
                updateOwnerTable({
                  ...ownerTableState,
                  page: Math.max(1, ownerPage - 1),
                })
              }
              type="button"
            >
              Previous
            </button>
            <div className="text-sm text-[var(--muted)]">
              {ownerPageStart}-{ownerPageEnd} / {ownerTotal}
            </div>
            <button
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={ownerPage >= ownerTotalPages}
              onClick={() =>
                updateOwnerTable({
                  ...ownerTableState,
                  page: Math.min(ownerTotalPages, ownerPage + 1),
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
