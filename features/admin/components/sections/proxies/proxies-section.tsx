import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { UserCheck } from "lucide-react";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { ProxyCrudDrawer, ProxyRowFocus } from "@/features/admin/components/proxy-crud-drawer";
import { proxyHref } from "@/features/admin/components/sections/proxies/proxy-hrefs";
import { tablePage, tablePerPage } from "@/features/admin/components/sections/shared/table";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
  ProxyTableFilters,
} from "@/features/admin/components/sections/types";

type ProxiesSectionProps = Pick<
    AdminDashboardData,
    "meetings"
    | "owners"
    | "profiles"
    | "proxyAuthorizations"
    | "rooms"
  > &
  Pick<
    AdminWorkspaceProps,
    "drawer"
    | "focusedProxyId"
    | "proxyFilters"
  > & {
  hidden: boolean;
};

export async function ProxiesSection({
  drawer,
  focusedProxyId,
  meetings,
  owners,
  profiles,
  proxyAuthorizations,
  proxyFilters,
  rooms,
  hidden,
}: ProxiesSectionProps) {
  const { s } = await getStaffI18n();
  const proxyTableFilters: Required<ProxyTableFilters> = {
    dir: proxyFilters?.dir ?? "asc",
    meeting: proxyFilters?.meeting ?? "",
    page: tablePage(proxyFilters?.page),
    perPage: tablePerPage(proxyFilters?.perPage),
    proxy: proxyFilters?.proxy ?? "",
    room: proxyFilters?.room ?? "",
    sort: proxyFilters?.sort ?? "meeting",
  };
  const filteredProxyAuthorizations = proxyAuthorizations.filter(
    (authorization) => {
      const meetingQuery = proxyTableFilters.meeting.trim().toLowerCase();
      const roomQuery = proxyTableFilters.room.trim().toLowerCase();
      const proxyQuery = proxyTableFilters.proxy.trim().toLowerCase();
      const matchesMeeting = meetingQuery
        ? (authorization.meetings?.title ?? "")
            .toLowerCase()
            .includes(meetingQuery)
        : true;
      const matchesRoom = roomQuery
        ? (authorization.rooms?.room_number ?? "")
            .toLowerCase()
            .includes(roomQuery)
        : true;
      const matchesProxy = proxyQuery
        ? [
            authorization.profiles?.full_name ?? "",
            authorization.profiles?.email ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(proxyQuery)
        : true;

      return matchesMeeting && matchesRoom && matchesProxy;
    },
  );
  const sortedProxyAuthorizations = [...filteredProxyAuthorizations].sort(
    (left, right) => {
      const direction = proxyTableFilters.dir === "asc" ? 1 : -1;
      const leftValue =
        proxyTableFilters.sort === "owner"
          ? left.owners?.full_name ?? ""
          : proxyTableFilters.sort === "proxy"
            ? left.profiles?.full_name ?? ""
            : proxyTableFilters.sort === "room"
              ? left.rooms?.room_number ?? ""
              : proxyTableFilters.sort === "status"
                ? left.status
                : left.meetings?.title ?? "";
      const rightValue =
        proxyTableFilters.sort === "owner"
          ? right.owners?.full_name ?? ""
          : proxyTableFilters.sort === "proxy"
            ? right.profiles?.full_name ?? ""
            : proxyTableFilters.sort === "room"
              ? right.rooms?.room_number ?? ""
              : proxyTableFilters.sort === "status"
                ? right.status
                : right.meetings?.title ?? "";

      return leftValue.localeCompare(rightValue) * direction;
    },
  );
  const proxyTotal = sortedProxyAuthorizations.length;
  const proxyTotalPages = Math.max(
    1,
    Math.ceil(proxyTotal / proxyTableFilters.perPage),
  );
  const proxyPage = Math.min(proxyTableFilters.page, proxyTotalPages);
  const proxyPageStart =
    proxyTotal === 0 ? 0 : (proxyPage - 1) * proxyTableFilters.perPage + 1;
  const proxyPageEnd = Math.min(
    proxyPage * proxyTableFilters.perPage,
    proxyTotal,
  );
  const pagedProxyAuthorizations = sortedProxyAuthorizations.slice(
    (proxyPage - 1) * proxyTableFilters.perPage,
    proxyPage * proxyTableFilters.perPage,
  );
  const proxyPageUrls = Object.fromEntries(
    Array.from({ length: proxyTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        proxyHref({ ...proxyTableFilters, page: pageNumber }),
      ],
    ),
  );
  const proxyPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      proxyHref({ ...proxyTableFilters, page: 1, perPage }),
    ]),
  );
  const proxySortHref = (sort: Required<ProxyTableFilters>["sort"]) =>
    proxyHref({
      ...proxyTableFilters,
      dir:
        proxyTableFilters.sort === sort && proxyTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const proxySortLabel = (sort: Required<ProxyTableFilters>["sort"]) =>
    proxyTableFilters.sort === sort
      ? proxyTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const proxyListHref = proxyHref({
    ...proxyTableFilters,
    page: proxyPage,
  });

  return (
    <section
      className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.proxies.title}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.proxies.intro}
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href={`${proxyListHref}&mode=create&type=proxy_authorization`}
        >
          {s.proxies.add}
        </a>
      </div>

      <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{s.common.searchCriteria}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {s.proxies.filter}
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-12">
          <input name="sort" type="hidden" value={proxyTableFilters.sort} />
          <input name="dir" type="hidden" value={proxyTableFilters.dir} />
          <input
            name="perPage"
            type="hidden"
            value={proxyTableFilters.perPage}
          />
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.proxies.meeting}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={proxyTableFilters.meeting}
              name="meeting"
              placeholder={s.proxies.searchMeeting}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.proxies.room}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={proxyTableFilters.room}
              name="room"
              placeholder={s.proxies.searchRoom}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
            {s.proxies.proxy}
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
              defaultValue={proxyTableFilters.proxy}
              name="proxy"
              placeholder={s.proxies.searchProxy}
            />
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
              href="/admin/proxies"
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
            {fill(s.common.showing, { start: proxyPageStart, end: proxyPageEnd, total: proxyTotal })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
          <PerPageSelect
            label={s.common.page}
            options={Array.from(
              { length: proxyTotalPages },
              (_, index) => index + 1,
            )}
            urlByValue={proxyPageUrls}
            value={proxyPage}
          />
          <div className="text-xs font-medium text-[var(--muted)]">
            {fill(s.common.ofPages, { total: proxyTotalPages })}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <PerPageSelect
            label={s.common.perPage}
            urlByValue={proxyPerPageUrls}
            value={proxyTableFilters.perPage}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">
                <a href={proxySortHref("meeting")}>
                  {s.proxies.meeting}{proxySortLabel("meeting")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={proxySortHref("room")}>
                  {s.proxies.room}{proxySortLabel("room")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={proxySortHref("owner")}>
                  {s.proxies.owner}{proxySortLabel("owner")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={proxySortHref("proxy")}>
                  {s.proxies.proxy}{proxySortLabel("proxy")}
                </a>
              </th>
              <th className="py-2 pr-3 font-medium">
                <a href={proxySortHref("status")}>
                  {s.common.status}{proxySortLabel("status")}
                </a>
              </th>
              <th className="py-2 font-medium">{s.common.action}</th>
            </tr>
          </thead>
          <tbody>
            {pagedProxyAuthorizations.map((authorization) => {
              const selected =
                drawer?.mode === "edit" &&
                drawer.type === "proxy_authorization" &&
                drawer.id === authorization.id;
              const focused = focusedProxyId === authorization.id;

              return (
                <tr
                  className={[
                    "border-b border-[var(--border)]",
                    selected || focused
                      ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                      : "",
                  ].join(" ")}
                  data-proxy-id={authorization.id}
                  key={authorization.id}
                  tabIndex={-1}
                >
                  <td className="py-2 pr-3">
                    {authorization.meetings?.title ?? "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {authorization.rooms?.room_number ?? "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {authorization.owners?.full_name ?? "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {authorization.profiles?.full_name ?? "-"}
                  </td>
                  <td className="py-2 pr-3">{codeLabel(s.common.code, authorization.status)}</td>
                  <td className="py-2">
                    <a
                      className="inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                      href={`${proxyListHref}&mode=edit&type=proxy_authorization&id=${authorization.id}`}
                    >
                      {s.proxies.review}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagedProxyAuthorizations.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {s.proxies.noProxies}
        </p>
      ) : null}
      <ProxyRowFocus authorizationId={focusedProxyId} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          aria-disabled={proxyPage <= 1}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            proxyPage <= 1 ? "pointer-events-none opacity-50" : "",
          ].join(" ")}
          href={proxyHref({
            ...proxyTableFilters,
            page: Math.max(1, proxyPage - 1),
          })}
        >
          {s.common.previous}
        </a>
        <div className="text-sm text-[var(--muted)]">
          {proxyPageStart}-{proxyPageEnd} / {proxyTotal}
        </div>
        <a
          aria-disabled={proxyPage >= proxyTotalPages}
          className={[
            "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
            proxyPage >= proxyTotalPages
              ? "pointer-events-none opacity-50"
              : "",
          ].join(" ")}
          href={proxyHref({
            ...proxyTableFilters,
            page: Math.min(proxyTotalPages, proxyPage + 1),
          })}
        >
          {s.common.next}
        </a>
      </div>
      {drawer?.mode === "create" && drawer.type === "proxy_authorization" ? (
        <ProxyCrudDrawer
          closeHref={proxyListHref}
          meetings={meetings}
          mode="create"
          owners={owners}
          profiles={profiles}
          rooms={rooms}
        />
      ) : null}
      {drawer?.mode === "edit" && drawer.type === "proxy_authorization"
        ? proxyAuthorizations
            .filter((authorization) => authorization.id === drawer.id)
            .map((authorization) => (
              <ProxyCrudDrawer
                authorization={authorization}
                closeHref={proxyListHref}
                key={authorization.id}
                meetings={meetings}
                mode="edit"
                owners={owners}
                profiles={profiles}
                rooms={rooms}
              />
            ))
        : null}
    </section>
  );
}
