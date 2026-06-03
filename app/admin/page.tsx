import Link from "next/link";
import { getAdminDashboardData } from "@/features/admin/data";

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

export default async function AdminDashboardPage() {
  const {
    rooms,
    owners,
    roomOwners,
    meetings,
    questions,
    manualBallots,
    voteSourceResolutions,
    proxyAuthorizations,
    eligibleVoters,
    resultSnapshots,
    committeeApprovals,
    emailLogs,
    profiles,
  } = await getAdminDashboardData();
  const stats = [
    ["Active rooms", rooms.filter((room) => room.active).length],
    ["Active owners", owners.filter((owner) => owner.active).length],
    ["Room links", roomOwners.filter((link) => !link.ends_at).length],
    ["Meetings", meetings.filter((meeting) => meeting.status !== "archived").length],
    ["Questions", questions.length],
    ["Eligible", eligibleVoters.length],
    ["Manual votes", manualBallots.length],
    ["Conflicts", voteSourceResolutions.length],
    [
      "Proxy requests",
      proxyAuthorizations.filter((authorization) => authorization.status === "pending")
        .length,
    ],
    ["Results", resultSnapshots.length],
    ["Approvals", committeeApprovals.length],
    ["Queued mail", emailLogs.filter((log) => log.status === "queued").length],
    ["Profiles", profiles.length],
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

        <section className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4 lg:grid-cols-6">
          {stats.map(([label, value]) => (
            <div
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              key={label}
            >
              <div className="font-semibold">{value}</div>
              <div className="text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {dashboardLinks.map((link) => (
            <Link
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
              href={link.href}
              key={link.href}
            >
              <h2 className="text-lg font-semibold">{link.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {link.description}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
