import type { AuditLogFilters } from "@/features/admin/data-modules/documents";
import type { getAdminDashboardData } from "@/features/admin/data";

export type AdminSection =
  | "setup"
  | "storage"
  | "audit"
  | "voting"
  | "committee"
  | "meetings"
  | "questions"
  | "results"
  | "email"
  | "people"
  | "ownership"
  | "proxies"
  | "profiles"
  | "rooms"
  | "owners";

export type AdminWorkspaceProps = {
  activeSection?: AdminSection | string;
  /** Shown under the page heading, before the sections. */
  intro?: import("react").ReactNode;
  auditFilters?: AuditLogFilters;
  committeeFilters?: CommitteeTableFilters;
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  focusedCommitteeId?: string;
  focusedEmailLogId?: string;
  focusedMeetingId?: string;
  focusedManualBallotId?: string;
  focusedProxyId?: string;
  focusedQuestionId?: string;
  focusedResultSnapshotId?: string;
  meetingFilters?: MeetingTableFilters;
  resultFilters?: ResultTableFilters;
  emailFilters?: EmailTableFilters;
  manualVoteFilters?: ManualVoteTableFilters;
  ownershipCreateHref?: string;
  proxyFilters?: ProxyTableFilters;
  sections?: AdminSection[];
  title?: string;
  description?: string;
};

export type MeetingTableFilters = {
  dir?: "asc" | "desc";
  noType?: string;
  page?: number;
  perPage?: number;
  sort?: "no_type" | "status" | "title" | "window";
  status?: string;
  title?: string;
};

export type ResultTableFilters = {
  approval?: string;
  dir?: "asc" | "desc";
  generated?: string;
  meeting?: string;
  page?: number;
  perPage?: number;
  sort?: "approval" | "generated" | "meeting";
};

export type EmailTableFilters = {
  created?: string;
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
  recipient?: string;
  sort?: "created" | "recipient" | "status";
  status?: string;
};

export type ProxyTableFilters = {
  dir?: "asc" | "desc";
  meeting?: string;
  page?: number;
  perPage?: number;
  proxy?: string;
  room?: string;
  sort?: "meeting" | "owner" | "proxy" | "room" | "status";
};

export type ManualVoteTableFilters = {
  dir?: "asc" | "desc";
  meeting?: string;
  page?: number;
  perPage?: number;
  room?: string;
  sort?: "meeting" | "question" | "room";
};

export type CommitteeTableFilters = {
  dir?: "asc" | "desc";
  memberName?: string;
  page?: number;
  perPage?: number;
  position?: string;
  sort?: "name" | "position" | "status";
  status?: string;
};

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
