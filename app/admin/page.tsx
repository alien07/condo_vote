import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  Languages,
  Link2,
  Mail,
  Send,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { getAdminDashboardData } from "@/features/admin/data";
import { MeetingSpotlight } from "@/features/admin/overview/meeting-spotlight";
import { MetricCard, type MetricCardProps } from "@/features/admin/overview/metric-card";
import { fetchEnglishDraftCount, fetchMeetingTurnout } from "@/features/admin/overview/overview-data";
import { attentionCounts, nextDraftMeeting, spotlightMeetings } from "@/features/admin/overview/overview-model";
import { PENDING_ACCOUNTS_HREF } from "@/features/admin/components/sections/people/people-table-state";
import { getCurrentProfileWithRoles } from "@/lib/auth/permissions";
import { linkIfAllowed } from "@/lib/auth/route-access";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";
import { SystemAccessBanner } from "@/features/system/system-access-banner";

function percent(value: number, total: number) {
  return total <= 0 ? 0 : Math.round((value / total) * 100);
}

// Admin overview (req_0008): what is waiting now first, then the meeting
// that is open for voting, then readiness and master data.
export default async function AdminDashboardPage() {
  const now = new Date();
  const supabase = await createClient();
  const [data, { locale, s }, current, englishDrafts, queuedMail] = await Promise.all([
    getAdminDashboardData(),
    getStaffI18n(),
    getCurrentProfileWithRoles(),
    fetchEnglishDraftCount(supabase),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "queued"),
  ]);
  const {
    rooms,
    owners,
    roomOwners,
    meetings,
    manualBallots,
    voteSourceResolutions,
    ballots,
    proxyAuthorizations,
    resultSnapshots,
    resultPublications,
    resultDecisions,
    pendingManualBallots,
    profiles,
  } = data;
  const t = s.adminHome.overview;
  // Only the manager (admin role) approves accounts (updateProfileAccess).
  const isManager = current?.roles.includes("admin") ?? false;
  const roles = current?.roles ?? [];
  // A card links only where these roles may go (req_0009): office staff
  // see the count of a Manager-only list without a link to it.
  const linked = (cards: MetricCardProps[]) =>
    cards.map((card) => ({ ...card, href: card.href ? linkIfAllowed(card.href, roles) : undefined }));
  const counts = attentionCounts({
    profiles,
    proxyAuthorizations,
    resultSnapshots,
    resultPublications,
    resultDecisions,
    pendingManualBallots,
    onlineBallots: ballots,
    countedPaperBallots: manualBallots.filter(
      (ballot) => ballot.status === "submitted" && ballot.identity_status !== "pending",
    ),
    resolutions: voteSourceResolutions,
    englishDrafts,
  });

  // 1. Waiting for you: amber when something waits, one line when nothing does.
  const waiting = (count: number) => count > 0;
  const attention: MetricCardProps[] = [
    ...(isManager
      ? [
          {
            href: PENDING_ACCOUNTS_HREF,
            icon: UserPlus,
            label: t.pendingAccounts,
            value: String(counts.pendingAccounts),
            detail: fill(t.pendingAccountsDetail, { count: profiles.length }),
            status: waiting(counts.pendingAccounts) ? t.needsReview : t.allClear,
            tone: waiting(counts.pendingAccounts) ? ("waiting" as const) : ("complete" as const),
          },
        ]
      : []),
    ...(isManager
      ? [
          {
            href: "/admin/proxies",
            icon: UserCheck,
            label: t.proxyRequests,
            value: String(counts.proxyRequests),
            detail: t.proxyRequestsDetail,
            status: waiting(counts.proxyRequests) ? t.needsReview : t.allClear,
            tone: waiting(counts.proxyRequests) ? ("waiting" as const) : ("complete" as const),
          },
          {
            href: "/admin/results?approval=pending",
            icon: BarChart3,
            label: t.pendingResults,
            value: String(counts.pendingResults),
            detail: t.pendingResultsDetail,
            status: waiting(counts.pendingResults) ? t.needsReview : t.allClear,
            tone: waiting(counts.pendingResults) ? ("waiting" as const) : ("complete" as const),
          },
        ]
      : []),
    // Shown only when a result did not pass (D027): the Manager acts on it.
    ...(isManager && counts.notPassedResults
      ? [
          {
            href: "/admin/results?approval=not_passed",
            icon: XCircle,
            label: t.notPassedResults,
            value: String(counts.notPassedResults),
            detail: t.notPassedResultsDetail,
            status: t.needsReview,
            tone: "waiting" as const,
          },
        ]
      : []),
    {
      href: "/admin/voting",
      icon: Send,
      label: t.paperIdentity,
      value: String(counts.paperIdentity),
      detail: t.paperIdentityDetail,
      status: waiting(counts.paperIdentity) ? t.needsReview : t.allClear,
      tone: waiting(counts.paperIdentity) ? ("waiting" as const) : ("complete" as const),
    },
    {
      href: "/admin/voting/conflicts?status=unresolved",
      icon: AlertTriangle,
      label: t.conflicts,
      value: String(counts.conflicts),
      detail: t.conflictsDetail,
      status: waiting(counts.conflicts) ? t.needsReview : t.allClear,
      tone: waiting(counts.conflicts) ? ("waiting" as const) : ("complete" as const),
    },
    ...(isManager && counts.englishDrafts
      ? [
          {
            href: "/admin/meetings?tab=meetings&status=draft",
            icon: Languages,
            label: t.englishDrafts,
            value: String(counts.englishDrafts),
            detail: t.englishDraftsDetail,
            status: t.needsReview,
            tone: "waiting" as const,
          },
        ]
      : []),
  ];
  const attentionOpen = linked(attention.filter((card) => card.tone === "waiting"));
  const attentionClear = linked(attention.filter((card) => card.tone !== "waiting"));

  // 2. Meetings now: turnout and quorum only (D015).
  const spotlight = spotlightMeetings(meetings, now);
  const turnouts = await Promise.all(
    spotlight.map((entry) => (entry.state === "open" ? fetchMeetingTurnout(supabase, entry.meeting) : null)),
  );
  const nextDraft = spotlight.length === 0 ? nextDraftMeeting(meetings, now) : null;

  // 3. Readiness: progress on white; green only when complete.
  const activeRoomIds = new Set(rooms.filter((room) => room.active).map((room) => room.id));
  const linkedRooms = new Set(
    roomOwners
      .filter((link) => !link.ends_at && link.rooms?.id && activeRoomIds.has(link.rooms.id))
      .map((link) => link.rooms!.id),
  ).size;
  const draftMeetings = meetings.filter((meeting) => meeting.status === "draft").length;
  const openMeetings = spotlight.filter((entry) => entry.state === "open").length;
  const readiness: MetricCardProps[] = [
    {
      href: "/admin/meetings?tab=meetings",
      icon: CalendarDays,
      label: t.meetings,
      value: String(draftMeetings + openMeetings),
      detail: fill(t.meetingsDetail, { draft: draftMeetings, open: openMeetings }),
      tone: "info",
    },
    {
      href: "/admin/ownership",
      icon: Link2,
      label: t.roomLinks,
      value: `${percent(linkedRooms, activeRoomIds.size)}%`,
      detail: fill(t.roomLinksDetail, { linked: linkedRooms, total: activeRoomIds.size }),
      percent: percent(linkedRooms, activeRoomIds.size),
      status: linkedRooms >= activeRoomIds.size ? t.complete : undefined,
      tone: linkedRooms >= activeRoomIds.size ? "complete" : "progress",
    },
    ...(isManager
      ? [
          {
            href: "/admin/communications",
            icon: Mail,
            label: t.queuedMail,
            value: String(queuedMail.count ?? 0),
            // Emails are only queued until sending is set up: not a warning.
            detail: s.communications.notSentYet,
            tone: "info" as const,
          },
        ]
      : []),
  ];

  // 4. Master data.
  const activeOwners = owners.filter((owner) => owner.active).length;
  const master: MetricCardProps[] = [
    {
      href: "/admin/people?tab=rooms",
      icon: Building2,
      label: t.activeRooms,
      value: String(activeRoomIds.size),
      detail: fill(t.activeRoomsDetail, { active: activeRoomIds.size, total: rooms.length }),
      tone: "info",
    },
    {
      href: "/admin/people?tab=owners",
      icon: Users,
      label: t.activeOwners,
      value: String(activeOwners),
      detail: fill(t.activeOwnersDetail, { active: activeOwners, total: owners.length }),
      tone: "info",
    },
    {
      href: "/admin/people?tab=profiles",
      icon: ClipboardList,
      label: t.profiles,
      value: String(profiles.length),
      detail: fill(t.profilesDetail, {
        owners: profiles.filter((profile) => profile.default_status === "owner").length,
        residents: profiles.filter((profile) => profile.default_status === "resident").length,
      }),
      tone: "info",
    },
  ];
  const groupTitle = "mb-3 text-lg font-semibold";
  const cardGrid = "grid grid-cols-2 gap-3 lg:grid-cols-4";

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      {/* A System Admin reading the building's data now (D027). */}
      <SystemAccessBanner only="others" />
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-semibold">{s.adminHome.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{s.adminHome.intro}</p>
        </div>

        <section className="mb-8" data-overview-group="attention">
          <h2 className={groupTitle}>{t.groups.attention}</h2>
          {attentionOpen.length ? (
            <div className={cardGrid}>
              {attentionOpen.map((card) => (
                <MetricCard key={card.label} {...card} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm" data-nothing-waiting>
              {t.nothingWaiting}
            </p>
          )}
          {attentionClear.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attentionClear.map((card) => (
                <MetricCard compact key={card.label} {...card} />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mb-8" data-overview-group="live">
          <h2 className={groupTitle}>{t.groups.live}</h2>
          {spotlight.length ? (
            <div className="grid gap-4">
              {spotlight.map((entry, index) => (
                <MeetingSpotlight
                  href={linkIfAllowed(
                    `/admin/meetings?tab=meetings&status=published&focusMeetingId=${entry.meeting.id}`,
                    roles,
                  )}
                  key={entry.meeting.id}
                  locale={locale}
                  meeting={entry.meeting}
                  now={now}
                  s={s}
                  state={entry.state}
                  turnout={turnouts[index]}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]" data-no-live-meeting>
              {t.noLive}
              {nextDraft ? <> {fill(t.nextDraft, { title: nextDraft.title })}</> : null}
            </p>
          )}
        </section>

        <section className="mb-8" data-overview-group="readiness">
          <h2 className={groupTitle}>{t.groups.readiness}</h2>
          <div className={cardGrid}>
            {linked(readiness).map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
        </section>

        <section data-overview-group="master">
          <h2 className={groupTitle}>{t.groups.master}</h2>
          <div className={cardGrid}>
            {linked(master).map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
