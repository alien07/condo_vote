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

const dashboardLinks = [
  {
    href: "/admin/setup",
    title: "Setup",
    description:
      "Juristic profile, private document registry, committee members, and audit log.",
  },
  {
    href: "/admin/people",
    title: "People",
    description: "Rooms, owners, profiles, and app roles.",
  },
  {
    href: "/admin/ownership",
    title: "Ownership",
    description: "Room owner links and ownership dates.",
  },
  {
    href: "/admin/meetings",
    title: "Meetings",
    description: "Meeting setup, questions, choices, publish, and archive.",
  },
  {
    href: "/admin/voting",
    title: "Voting",
    description: "Manual ballots and manual/online conflict resolution.",
  },
  {
    href: "/admin/results",
    title: "Results",
    description: "Snapshots, approval, and locked result state.",
  },
  {
    href: "/admin/proxies",
    title: "Proxies",
    description: "Proxy authorization review.",
  },
  {
    href: "/admin/communications",
    title: "Communications",
    description: "Mock email queue and delivery logs.",
  },
];

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
      title: "Master Data",
      description: "Room, owner, and profile readiness.",
      metrics: [
        {
          href: "/admin/people",
          icon: Building2,
          label: "Active rooms",
          value: `${activeRooms} / ${totalRooms}`,
          detail: `${activeRooms} of ${totalRooms} rooms active`,
          percent: percent(activeRooms, totalRooms),
          status: `${formatPercent(percent(activeRooms, totalRooms))} active`,
          tone: "success" as const,
        },
        {
          href: "/admin/people",
          icon: Users,
          label: "Active owners",
          value: `${activeOwners} / ${totalOwners}`,
          detail: `${activeOwners} of ${totalOwners} owners active`,
          percent: percent(activeOwners, totalOwners),
          status: `${formatPercent(percent(activeOwners, totalOwners))} active`,
          tone: "success" as const,
        },
        {
          href: "/admin/ownership",
          icon: Link2,
          label: "Room links",
          value: `${linkedActiveRoomIds.size} / ${activeRooms}`,
          detail: `${activeRoomOwnerLinks} active ownership links`,
          percent: percent(linkedActiveRoomIds.size, activeRooms),
          status: `${formatPercent(percent(linkedActiveRoomIds.size, activeRooms))} coverage`,
          tone:
            linkedActiveRoomIds.size < activeRooms ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/people",
          icon: UserCheck,
          label: "Profiles",
          value: String(profiles.length),
          detail: `${ownerProfiles} owners, ${residentProfiles} residents`,
          status: "View profiles",
        },
      ],
    },
    {
      title: "Voting Readiness",
      description: "Meeting setup and eligible voter coverage.",
      metrics: [
        {
          href: "/admin/meetings",
          icon: ClipboardList,
          label: "Meetings",
          value: String(activeMeetings),
          detail: `${activeMeetings} active, ${archivedMeetings} archived`,
          status: "Manage meetings",
        },
        {
          href: "/admin/meetings",
          icon: Vote,
          label: "Questions",
          value: String(questions.length),
          detail: `${questions.length} agenda questions configured`,
          status: "Review agenda",
        },
        {
          href: "/admin/voting",
          icon: CheckCircle2,
          label: "Eligible voters",
          value: `${eligibleRoomIds.size} / ${activeRooms}`,
          detail: `${eligibleVoters.length} eligible voter records`,
          percent: percent(eligibleRoomIds.size, activeRooms),
          status: `${formatPercent(percent(eligibleRoomIds.size, activeRooms))} room coverage`,
          tone:
            eligibleRoomIds.size < activeRooms ? ("warning" as const) : ("success" as const),
        },
      ],
    },
    {
      title: "Needs Attention",
      description: "Operational queues that may require admin action.",
      metrics: [
        {
          href: "/admin/voting",
          icon: AlertTriangle,
          label: "Conflicts",
          value: String(conflictCount),
          detail: `${voteSourceResolutions.length} source resolutions recorded`,
          status: conflictCount > 0 ? "Review required" : "All clear",
          tone: conflictCount > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/communications",
          icon: Mail,
          label: "Queued mail",
          value: String(queuedEmailCount),
          detail: `${emailLogs.length} recent email log records`,
          status: queuedEmailCount > 0 ? "Send/check queue" : "All clear",
          tone: queuedEmailCount > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          href: "/admin/proxies",
          icon: UserCheck,
          label: "Proxy requests",
          value: String(pendingProxyAuthorizations),
          detail: `${proxyAuthorizations.length} proxy requests total`,
          status: pendingProxyAuthorizations > 0 ? "Review pending" : "All clear",
          tone:
            pendingProxyAuthorizations > 0
              ? ("warning" as const)
              : ("success" as const),
        },
      ],
    },
    {
      title: "Results & Communication",
      description: "Result snapshot approval and delivery readiness.",
      metrics: [
        {
          href: "/admin/results",
          icon: BarChart3,
          label: "Results",
          value: String(resultSnapshots.length),
          detail: `${resultSnapshots.length} generated snapshots`,
          status: "Open results",
        },
        {
          href: "/admin/results",
          icon: CheckCircle2,
          label: "Approvals",
          value: `${approvedResultCount} / ${resultSnapshots.length}`,
          detail: `${approvedResultCount} committee approvals recorded`,
          percent: percent(approvedResultCount, resultSnapshots.length),
          status: `${formatPercent(percent(approvedResultCount, resultSnapshots.length))} approved`,
          tone:
            approvedResultCount < resultSnapshots.length
              ? ("warning" as const)
              : ("success" as const),
        },
        {
          href: "/admin/communications",
          icon: Send,
          label: "Manual votes",
          value: String(manualBallots.length),
          detail: `${manualBallots.length} manual ballots, ${eligibleVoters.length} eligible records`,
          percent: percent(manualBallots.length, eligibleVoters.length),
          status: `${formatPercent(percent(manualBallots.length, eligibleVoters.length))} of eligible records`,
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Dashboard overview and shortcuts for the condoVotes admin workspace.
          </p>
        </div>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Operational Dashboard</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Readiness, attention items, and result delivery status.
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
            <h2 className="text-xl font-semibold">Admin Functions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open a workspace area to manage setup, people, meetings, voting,
              results, proxies, or communications.
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
