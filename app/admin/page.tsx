import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Link2,
  Mail,
  Send,
  UserCheck,
  Users,
  Vote,
} from "lucide-react";
import { getAdminDashboardData } from "@/features/admin/data";
import { MissingEnglishPanel } from "@/features/english/missing-english-panel";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";

type MetricCardProps = {
  actionLabel?: string;
  detail: string;
  href: string;
  icon: typeof Building2;
  label: string;
  percent?: number;
  status: string;
  tone?: "default" | "warning" | "success";
  value: string;
};

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function MetricCard({
  actionLabel,
  detail,
  href,
  icon: Icon,
  label,
  percent: percentValue,
  status,
  tone = "default",
  value,
}: MetricCardProps) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-50"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50"
        : "border-[var(--border)] bg-[var(--surface)]";
  const statusClass =
    tone === "warning"
      ? "text-amber-800"
      : tone === "success"
        ? "text-emerald-800"
        : "text-[var(--muted)]";

  return (
    <Link
      className={[
        "flex min-h-32 flex-col rounded-lg border p-4 transition hover:border-[var(--primary)] hover:shadow-sm",
        toneClass,
      ].join(" ")}
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {value}
          </div>
        </div>
        <Icon
          className={
            tone === "warning"
              ? "shrink-0 text-amber-700"
              : "shrink-0 text-[var(--primary)]"
          }
          size={20}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">{detail}</div>
      {typeof percentValue === "number" ? (
        <div className="mt-3">
          <div className="h-2 rounded-full bg-black/10">
            <div
              className="h-2 rounded-full bg-[var(--primary)]"
              style={{ width: formatPercent(percentValue) }}
            />
          </div>
        </div>
      ) : null}
      <div
        className={[
          "mt-auto pt-3 text-xs font-medium",
          statusClass,
        ].join(" ")}
      >
        {actionLabel ?? status}
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const {
    rooms,
    owners,
    roomOwners,
    meetings,
    questions,
    manualBallots,
    voteSourceResolutions,
    ballots,
    proxyAuthorizations,
    eligibleVoters,
    resultSnapshots,
    committeeApprovals,
    emailLogs,
    profiles,
  } = await getAdminDashboardData();
  const { s: staff } = await getStaffI18n();
  const t = staff.adminHome;
  const m = t.metrics;
  const dashboardLinks = [
    { href: "/admin/setup?tab=setup", title: t.links.setupTitle, description: t.links.setupText },
    { href: "/admin/people?tab=rooms", title: t.links.peopleTitle, description: t.links.peopleText },
    { href: "/admin/ownership", title: t.links.ownershipTitle, description: t.links.ownershipText },
    { href: "/admin/meetings?tab=meetings", title: t.links.meetingsTitle, description: t.links.meetingsText },
    { href: "/admin/voting", title: t.links.votingTitle, description: t.links.votingText },
    { href: "/admin/results", title: t.links.resultsTitle, description: t.links.resultsText },
    { href: "/admin/proxies", title: t.links.proxiesTitle, description: t.links.proxiesText },
    { href: "/admin/communications", title: t.links.communicationsTitle, description: t.links.communicationsText },
  ];
  const totalRooms = rooms.length;
  const activeRooms = rooms.filter((room) => room.active).length;
  const activeRoomIds = new Set(
    rooms.filter((room) => room.active).map((room) => room.id),
  );
  const totalOwners = owners.length;
  const activeOwners = owners.filter((owner) => owner.active).length;
  const activeRoomOwnerLinks = roomOwners.filter((link) => !link.ends_at).length;
  const linkedActiveRoomIds = new Set(
    roomOwners
      .filter((link) => !link.ends_at && link.rooms?.id)
      .map((link) => link.rooms!.id)
      .filter((roomId) => activeRoomIds.has(roomId)),
  );
  const activeMeetings = meetings.filter(
    (meeting) => meeting.status !== "archived",
  ).length;
  const archivedMeetings = meetings.length - activeMeetings;
  const eligibleRoomIds = new Set(
    eligibleVoters
      .map((eligibleVoter) => eligibleVoter.room_id)
      .filter((roomId) => activeRoomIds.has(roomId)),
  );
  const submittedOnlineRoomKeys = new Set(
    ballots.map((ballot) => `${ballot.meeting_id}:${ballot.room_id}`),
  );
  const manualRoomKeys = new Set(
    manualBallots.map((ballot) => `${ballot.meeting_id}:${ballot.room_id}`),
  );
  const conflictCount = [...manualRoomKeys].filter((key) =>
    submittedOnlineRoomKeys.has(key),
  ).length;
  const pendingProxyAuthorizations = proxyAuthorizations.filter(
    (authorization) => authorization.status === "pending",
  ).length;
  const queuedEmailCount = emailLogs.filter((log) => log.status === "queued").length;
  const approvedResultCount = committeeApprovals.length;
  const ownerProfiles = profiles.filter(
    (profile) => profile.default_status === "owner",
  ).length;
  const residentProfiles = profiles.filter(
    (profile) => profile.default_status === "resident",
  ).length;
  const dashboardGroups = [
    {
      title: t.groups.masterTitle,
      description: t.groups.masterText,
      metrics: [
        {
          href: "/admin/people?tab=rooms",
          icon: Building2,
          label: m.activeRooms,
          value: `${activeRooms} / ${totalRooms}`,
          detail: fill(m.activeRoomsDetail, { active: activeRooms, total: totalRooms }),
          percent: percent(activeRooms, totalRooms),
          status: fill(m.active, { percent: formatPercent(percent(activeRooms, totalRooms)) }),
          tone: "success" as const,
        },
        {
          href: "/admin/people?tab=owners",
          icon: Users,
          label: m.activeOwners,
          value: `${activeOwners} / ${totalOwners}`,
          detail: fill(m.activeOwnersDetail, { active: activeOwners, total: totalOwners }),
          percent: percent(activeOwners, totalOwners),
          status: fill(m.active, { percent: formatPercent(percent(activeOwners, totalOwners)) }),
          tone: "success" as const,
        },
        {
          href: "/admin/ownership",
          icon: Link2,
          label: m.roomLinks,
          value: `${linkedActiveRoomIds.size} / ${activeRooms}`,
          detail: fill(m.roomLinksDetail, { count: activeRoomOwnerLinks }),
          percent: percent(linkedActiveRoomIds.size, activeRooms),
          status: fill(m.coverage, {
            percent: formatPercent(percent(linkedActiveRoomIds.size, activeRooms)),
          }),
          tone:
            linkedActiveRoomIds.size < activeRooms ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/people?tab=profiles",
          icon: UserCheck,
          label: m.profiles,
          value: String(profiles.length),
          detail: fill(m.profilesDetail, { owners: ownerProfiles, residents: residentProfiles }),
          status: m.viewProfiles,
        },
      ],
    },
    {
      title: t.groups.readinessTitle,
      description: t.groups.readinessText,
      metrics: [
        {
          href: "/admin/meetings?tab=meetings",
          icon: ClipboardList,
          label: m.meetings,
          value: String(activeMeetings),
          detail: fill(m.meetingsDetail, { active: activeMeetings, archived: archivedMeetings }),
          status: m.manageMeetings,
        },
        {
          href: "/admin/meetings?tab=questions",
          icon: Vote,
          label: m.questions,
          value: String(questions.length),
          detail: fill(m.questionsDetail, { count: questions.length }),
          status: m.reviewAgenda,
        },
        {
          href: "/admin/voting",
          icon: CheckCircle2,
          label: m.eligible,
          value: `${eligibleRoomIds.size} / ${activeRooms}`,
          detail: fill(m.eligibleDetail, { count: eligibleVoters.length }),
          percent: percent(eligibleRoomIds.size, activeRooms),
          status: fill(m.roomCoverage, {
            percent: formatPercent(percent(eligibleRoomIds.size, activeRooms)),
          }),
          tone:
            eligibleRoomIds.size < activeRooms ? ("warning" as const) : ("success" as const),
        },
      ],
    },
    {
      title: t.groups.attentionTitle,
      description: t.groups.attentionText,
      metrics: [
        {
          href: "/admin/voting",
          icon: AlertTriangle,
          label: m.conflicts,
          value: String(conflictCount),
          detail: fill(m.conflictsDetail, { count: voteSourceResolutions.length }),
          status: conflictCount > 0 ? m.reviewRequired : m.allClear,
          tone: conflictCount > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/communications",
          icon: Mail,
          label: m.queuedMail,
          value: String(queuedEmailCount),
          detail: fill(m.queuedMailDetail, { count: emailLogs.length }),
          status: queuedEmailCount > 0 ? m.checkQueue : m.allClear,
          tone: queuedEmailCount > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/proxies",
          icon: UserCheck,
          label: m.proxyRequests,
          value: String(pendingProxyAuthorizations),
          detail: fill(m.proxyRequestsDetail, { count: proxyAuthorizations.length }),
          status: pendingProxyAuthorizations > 0 ? m.reviewPending : m.allClear,
          tone:
            pendingProxyAuthorizations > 0
              ? ("warning" as const)
              : ("success" as const),
        },
      ],
    },
    {
      title: t.groups.resultsTitle,
      description: t.groups.resultsText,
      metrics: [
        {
          href: "/admin/results",
          icon: BarChart3,
          label: m.results,
          value: String(resultSnapshots.length),
          detail: fill(m.resultsDetail, { count: resultSnapshots.length }),
          status: m.openResults,
        },
        {
          href: "/admin/results",
          icon: CheckCircle2,
          label: m.approvals,
          value: `${approvedResultCount} / ${resultSnapshots.length}`,
          detail: fill(m.approvalsDetail, { count: approvedResultCount }),
          percent: percent(approvedResultCount, resultSnapshots.length),
          status: fill(m.approved, {
            percent: formatPercent(percent(approvedResultCount, resultSnapshots.length)),
          }),
          tone:
            approvedResultCount < resultSnapshots.length
              ? ("warning" as const)
              : ("success" as const),
        },
        {
          href: "/admin/voting",
          icon: Send,
          label: m.manualVotes,
          value: String(manualBallots.length),
          detail: fill(m.manualVotesDetail, {
            manual: manualBallots.length,
            eligible: eligibleVoters.length,
          }),
          percent: percent(manualBallots.length, eligibleVoters.length),
          status: fill(m.ofEligible, {
            percent: formatPercent(percent(manualBallots.length, eligibleVoters.length)),
          }),
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t.intro}
          </p>
        </div>

        <MissingEnglishPanel />

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">{t.dashboardTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t.dashboardIntro}
            </p>
          </div>
          <div className="grid gap-6">
          {dashboardGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-3">
                <h3 className="text-lg font-semibold">{group.title}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {group.metrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </section>
          ))}
          </div>
        </section>

        <section className="mt-8 border-t border-[var(--border)] pt-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">{t.functionsTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t.functionsIntro}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {dashboardLinks.map((link) => (
              <Link
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                href={link.href}
                key={link.href}
              >
                <h3 className="text-lg font-semibold">{link.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
