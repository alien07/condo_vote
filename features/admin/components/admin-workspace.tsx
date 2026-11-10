import { getAdminDashboardData } from "@/features/admin/data";
import { isSystemAdmin } from "@/lib/auth/permissions";
import { AdminSoftNavigation } from "@/features/admin/components/admin-soft-navigation";
import { ShieldCheck } from "lucide-react";
import { PeopleCrudPilot } from "@/features/admin/components/sections/people/people-crud-pilot";
import { AuditLogSection } from "@/features/admin/components/sections/setup/audit-log-section";
import { CommitteeSection } from "@/features/admin/components/sections/setup/committee-section";
import { DocumentStorageSection } from "@/features/admin/components/sections/setup/document-storage-section";
import { EmailSection } from "@/features/admin/components/sections/communications/email-section";
import { JuristicProfileSection } from "@/features/admin/components/sections/setup/juristic-profile-section";
import { ManualVotesSection } from "@/features/admin/components/sections/voting/manual-votes-section";
import { MeetingsSection } from "@/features/admin/components/sections/meetings/meetings-section";
import { OwnershipSection } from "@/features/admin/components/sections/people/ownership-section";
import { ProxiesSection } from "@/features/admin/components/sections/proxies/proxies-section";
import { QuestionsSection } from "@/features/admin/components/sections/meetings/questions-section";
import { ResultsSection } from "@/features/admin/components/sections/results/results-section";
import { deriveSharedAdminState } from "@/features/admin/components/sections/shared/derived";
import type {
  AdminSection,
  AdminWorkspaceProps,
} from "@/features/admin/components/sections/types";

export type {
  AdminSection,
  CommitteeTableFilters,
  EmailTableFilters,
  ManualVoteTableFilters,
  MeetingTableFilters,
  ProxyTableFilters,
  ResultTableFilters,
} from "@/features/admin/components/sections/types";

const allSections: AdminSection[] = [
  "setup",
  "storage",
  "audit",
  "voting",
  "committee",
  "meetings",
  "questions",
  "results",
  "email",
  "people",
  "ownership",
  "proxies",
  "profiles",
];

export async function AdminWorkspace({
  activeSection: requestedActiveSection,
  auditFilters,
  committeeFilters,
  drawer,
  emailFilters,
  focusedEmailLogId,
  focusedCommitteeId,
  focusedMeetingId,
  focusedManualBallotId,
  focusedProxyId,
  focusedQuestionId,
  focusedResultSnapshotId,
  manualVoteFilters,
  meetingFilters,
  ownershipCreateHref,
  proxyFilters,
  resultFilters,
  sections = allSections,
  title = "Admin",
  description = "Room, owner, profile, and role-controlled demo workspace.",
}: AdminWorkspaceProps) {
  const {
    condoProfile,
    appSettings,
    auditLogs,
    auditLogPage,
    auditLogPerPage,
    auditLogTotal,
    auditOptions,
    committeeMembers,
    rooms,
    appRoles,
    owners,
    roomOwners,
    meetings,
    questions,
    manualBallots,
    proxyAuthorizations,
    resultSnapshots,
    committeeApprovals,
    pendingManualBallots,
    emailLogs,
    profiles,
    resultPublications,
  } =
    await getAdminDashboardData({ auditFilters });
  const canEditTechnicalSettings = await isSystemAdmin();
  const {
    appRolesByProfile,
    approvalCountBySnapshotId,
    approvalBySnapshotId,
    approvedMeetingIds,
    approvedResultSnapshotIds,
    lockedMeetingIds,
    pendingManualBallotsByMeetingId,
  } = deriveSharedAdminState({
    appRoles,
    committeeApprovals,
    pendingManualBallots,
    profiles,
    resultPublications,
  });
  const activeSection =
    requestedActiveSection &&
    sections.includes(requestedActiveSection as AdminSection)
      ? (requestedActiveSection as AdminSection)
      : sections[0];
  const visibleSections = new Set([activeSection]);
  const sectionLabels = new Map<AdminSection, string>([
    ["setup", "Setup"],
    ["storage", "Storage"],
    ["committee", "Committee"],
    ["audit", "Audit"],
    ["voting", "Voting"],
    ["meetings", "Meetings"],
    ["questions", "Questions"],
    ["results", "Results"],
    ["email", "Email"],
    ["people", "Rooms & Owners"],
    ["rooms", "Rooms"],
    ["owners", "Owners"],
    ["ownership", "Ownership"],
    ["proxies", "Proxies"],
    ["profiles", "Profiles"],
  ]);

  return (
    <main className="min-h-screen px-6 py-8">
      <AdminSoftNavigation />
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-[var(--muted)]">{description}</p>
            </div>
          </div>
        </div>

        {sections.length > 1 ? (
          <div className="sticky top-0 z-10 mb-5 border-b border-[var(--border)] bg-[var(--background)] py-3">
            <div className="mb-3">
              <h2 className="text-sm font-semibold">Workspace sections</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Use these tabs to switch between focused sections in this admin
                workspace.
              </p>
            </div>
            <nav className="flex gap-2 overflow-x-auto text-sm">
              {sections.map((section) => {
                const active = section === activeSection;

                return (
                  <a
                    aria-current={active ? "page" : undefined}
                    className={[
                      "shrink-0 rounded-md border px-3 py-2 font-medium",
                      active
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)]",
                    ].join(" ")}
                    href={`?tab=${section}`}
                    key={section}
                  >
                    {sectionLabels.get(section)}
                  </a>
                );
              })}
            </nav>
          </div>
        ) : null}

        <JuristicProfileSection
          condoProfile={condoProfile}
          hidden={!visibleSections.has("setup")}
        />

        <DocumentStorageSection
          appSettings={appSettings}
          canEdit={canEditTechnicalSettings}
          hidden={!visibleSections.has("storage")}
        />

        <AuditLogSection
          auditFilters={auditFilters}
          auditLogPage={auditLogPage}
          auditLogPerPage={auditLogPerPage}
          auditLogs={auditLogs}
          auditLogTotal={auditLogTotal}
          auditOptions={auditOptions}
          hidden={!visibleSections.has("audit")}
        />

        <ManualVotesSection
          drawer={drawer}
          focusedManualBallotId={focusedManualBallotId}
          hidden={!visibleSections.has("voting")}
          manualBallots={manualBallots}
          manualVoteFilters={manualVoteFilters}
          meetings={meetings}
          profiles={profiles}
          rooms={rooms}
        />

        <CommitteeSection
          committeeFilters={committeeFilters}
          committeeMembers={committeeMembers}
          drawer={drawer}
          focusedCommitteeId={focusedCommitteeId}
          hidden={!visibleSections.has("committee")}
          profiles={profiles}
        />

        <MeetingsSection
          approvedMeetingIds={approvedMeetingIds}
          lockedMeetingIds={lockedMeetingIds}
          drawer={drawer}
          focusedMeetingId={focusedMeetingId}
          hidden={!visibleSections.has("meetings")}
          meetingFilters={meetingFilters}
          meetings={meetings}
          pendingManualBallotsByMeetingId={pendingManualBallotsByMeetingId}
        />

        <QuestionsSection
          drawer={drawer}
          focusedQuestionId={focusedQuestionId}
          hidden={!visibleSections.has("questions")}
          meetings={meetings}
          questions={questions}
        />

        <ResultsSection
          approvalBySnapshotId={approvalBySnapshotId}
          approvalCountBySnapshotId={approvalCountBySnapshotId}
          approvedMeetingIds={approvedMeetingIds}
          approvedResultSnapshotIds={approvedResultSnapshotIds}
          lockedMeetingIds={lockedMeetingIds}
          committeeMembers={committeeMembers}
          condoProfile={condoProfile}
          drawer={drawer}
          focusedResultSnapshotId={focusedResultSnapshotId}
          hidden={!visibleSections.has("results")}
          pendingManualBallotsByMeetingId={pendingManualBallotsByMeetingId}
          resultFilters={resultFilters}
          resultSnapshots={resultSnapshots}
        />

        <EmailSection
          drawer={drawer}
          emailFilters={emailFilters}
          emailLogs={emailLogs}
          focusedEmailLogId={focusedEmailLogId}
          hidden={!visibleSections.has("email")}
          meetings={meetings}
        />

        <div hidden={!visibleSections.has("people")} id="people">
          <PeopleCrudPilot
            activeSection="rooms"
            appRolesByProfile={appRolesByProfile}
            drawer={drawer}
            owners={owners}
            profiles={profiles}
            rooms={rooms}
          />
        </div>

        <div hidden={!visibleSections.has("rooms")} id="rooms">
          <PeopleCrudPilot
            activeSection="rooms"
            appRolesByProfile={appRolesByProfile}
            drawer={drawer}
            owners={owners}
            profiles={profiles}
            rooms={rooms}
          />
        </div>

        <div hidden={!visibleSections.has("owners")} id="owners">
          <PeopleCrudPilot
            activeSection="owners"
            appRolesByProfile={appRolesByProfile}
            drawer={drawer}
            owners={owners}
            profiles={profiles}
            rooms={rooms}
          />
        </div>

        <OwnershipSection
          drawer={drawer}
          hidden={!visibleSections.has("ownership")}
          owners={owners}
          ownershipCreateHref={ownershipCreateHref}
          roomOwners={roomOwners}
          rooms={rooms}
        />

        <ProxiesSection
          drawer={drawer}
          focusedProxyId={focusedProxyId}
          hidden={!visibleSections.has("proxies")}
          meetings={meetings}
          owners={owners}
          profiles={profiles}
          proxyAuthorizations={proxyAuthorizations}
          proxyFilters={proxyFilters}
          rooms={rooms}
        />

        <div hidden={!visibleSections.has("profiles")}>
          <PeopleCrudPilot
            activeSection="profiles"
            appRolesByProfile={appRolesByProfile}
            drawer={drawer}
            owners={owners}
            profiles={profiles}
            rooms={rooms}
          />
        </div>
      </section>
    </main>
  );
}
