import {
  Building2,
  CalendarDays,
  FileText,
  FolderLock,
  History,
  ListChecks,
  ShieldCheck,
  Upload,
  UserCheck,
} from "lucide-react";
import {
  approveResultSnapshot,
  archiveMeeting,
  createCommitteeMember,
  createMeetingChoice,
  createMeeting,
  createMeetingQuestion,
  createProxyAuthorization,
  deactivateCommitteeMember,
  deleteMeetingChoice,
  deleteMeetingQuestion,
  generateResultSnapshot,
  importOwnersExcel,
  importRoomOwnersExcel,
  importRoomsExcel,
  publishMeeting,
  reviewProxyAuthorization,
  resolveManualBallotIdentity,
  saveAppSettings,
  saveCondoProfile,
  startManualVoteImport,
} from "@/features/admin/actions";
import { EmailInviteControls } from "@/features/admin/components/email-invite-controls";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { AuditLogTable } from "@/features/admin/components/audit-log-table";
import { OwnershipManager } from "@/features/admin/components/ownership-manager";
import { PeopleCrudPilot } from "@/features/admin/components/people-crud-pilot";
import { PerPageSelect } from "@/features/admin/components/table-controls";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { getAdminDashboardData } from "@/features/admin/data";
import type { AuditLogFilters } from "@/features/admin/data-modules/documents";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getResultTotals(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("totals" in payload)) {
    return null;
  }

  const totals = payload.totals;

  if (!totals || typeof totals !== "object") {
    return null;
  }

  return totals as {
    eligible_voters?: number;
    submitted_ballots?: number;
    total_eligible_ownership?: number;
    submitted_ownership?: number;
  };
}

function getResultPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as {
    generated_at?: string;
    meeting?: {
      title?: string;
      meeting_number?: string | null;
      fiscal_year?: string | null;
      location?: string | null;
      starts_at?: string;
      ends_at?: string;
      chairperson_name?: string | null;
      quorum_rule?: string | null;
    };
    questions?: {
      agenda_no?: string | null;
      agenda_title?: string | null;
      text?: string;
      resolution_type?: string;
      required_threshold?: number | null;
      requires_land_office_registration?: boolean;
      legal_note?: string | null;
      choices?: {
        text?: string;
        vote_count?: number;
        ownership?: number;
        percent_of_total_ownership?: number;
        percent_of_submitted_ownership?: number;
      }[];
    }[];
    totals?: {
      eligible_voters?: number;
      submitted_ballots?: number;
      online_ballots?: number;
      manual_ballots?: number;
      total_eligible_ownership?: number;
      submitted_ownership?: number;
      source_conflicts?: number;
      resolved_source_conflicts?: number;
    };
    vote_source_audit?: {
      conflicts?: {
        chosen_source?: string | null;
        conflict_remark?: string | null;
        resolved_at?: string | null;
      }[];
    };
  };
}

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export function MasterDataImportForms() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form
        action={importRoomsExcel}
        className="rounded-md border border-[var(--border)] p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Upload className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">Import rooms</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Reads the `Rooms` sheet. Upsert key: `room_number`.
        </p>
        <div className="mb-3">
          <RequiredNote />
        </div>
        <a
          className="mb-3 inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
          href="/templates/rooms-import-template.xlsx"
        >
          Download rooms template
        </a>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Excel file</FieldLabel>
          <input
            accept=".xlsx"
            className="block w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            name="file"
            required
            type="file"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <PendingSubmitButton
            className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel="Uploading..."
            type="submit"
          >
            Upload rooms Excel
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
        </div>
      </form>

      <form
        action={importOwnersExcel}
        className="rounded-md border border-[var(--border)] p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Upload className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">Import owners</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Reads the `Owners` sheet. Upsert key: `email`.
        </p>
        <div className="mb-3">
          <RequiredNote />
        </div>
        <a
          className="mb-3 inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
          href="/templates/owners-import-template.xlsx"
        >
          Download owners template
        </a>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Excel file</FieldLabel>
          <input
            accept=".xlsx"
            className="block w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            name="file"
            required
            type="file"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <PendingSubmitButton
            className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel="Uploading..."
            type="submit"
          >
            Upload owners Excel
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
        </div>
      </form>

      <form
        action={importRoomOwnersExcel}
        className="rounded-md border border-[var(--border)] p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Upload className="text-[var(--primary)]" size={18} />
          <h3 className="font-semibold">Import room owners</h3>
        </div>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Reads the `RoomOwners` sheet. Links `room_number` to `owner_email`
          with role `owner`.
        </p>
        <div className="mb-3">
          <RequiredNote />
        </div>
        <a
          className="mb-3 inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
          href="/templates/room-owners-import-template.xlsx"
        >
          Download room owners template
        </a>
        <label className="grid gap-1 text-sm font-medium">
          <FieldLabel required>Excel file</FieldLabel>
          <input
            accept=".xlsx"
            className="block w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            name="file"
            required
            type="file"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <PendingSubmitButton
            className="min-h-10 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            pendingLabel="Uploading..."
            type="submit"
          >
            Upload room owners Excel
          </PendingSubmitButton>
          <FormResetButton label="Clear form" />
        </div>
      </form>
    </div>
  );
}

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

type AdminWorkspaceProps = {
  activeSection?: AdminSection | string;
  auditFilters?: AuditLogFilters;
  committeeFilters?: CommitteeTableFilters;
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  meetingFilters?: MeetingTableFilters;
  resultFilters?: ResultTableFilters;
  emailFilters?: EmailTableFilters;
  manualVoteFilters?: ManualVoteTableFilters;
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

function tablePage(value: number | undefined, fallback = 1) {
  return Number.isInteger(value) && value && value > 0 ? value : fallback;
}

function tablePerPage(value: number | undefined, fallback = 25) {
  const parsed =
    Number.isInteger(value) && value && value > 0 ? value : fallback;

  return Math.min(Math.max(parsed, 10), 100);
}

function meetingHref(filters: Required<MeetingTableFilters>) {
  const params = new URLSearchParams();

  params.set("tab", "meetings");
  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.title) {
    params.set("title", filters.title);
  }

  if (filters.noType) {
    params.set("noType", filters.noType);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/meetings?${params.toString()}`;
}

function resultHref(filters: Required<ResultTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.generated) {
    params.set("generated", filters.generated);
  }

  if (filters.approval && filters.approval !== "all") {
    params.set("approval", filters.approval);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/results?${params.toString()}`;
}

function emailHref(filters: Required<EmailTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.recipient) {
    params.set("recipient", filters.recipient);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.created) {
    params.set("created", filters.created);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/communications?${params.toString()}`;
}

function proxyHref(filters: Required<ProxyTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.proxy) {
    params.set("proxy", filters.proxy);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/proxies?${params.toString()}`;
}

function manualVoteHref(filters: Required<ManualVoteTableFilters>) {
  const params = new URLSearchParams();

  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.meeting) {
    params.set("meeting", filters.meeting);
  }

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/voting?${params.toString()}`;
}

function committeeHref(filters: Required<CommitteeTableFilters>) {
  const params = new URLSearchParams();

  params.set("tab", "committee");
  params.set("sort", filters.sort);
  params.set("dir", filters.dir);
  params.set("perPage", String(filters.perPage));

  if (filters.memberName) {
    params.set("memberName", filters.memberName);
  }

  if (filters.position) {
    params.set("position", filters.position);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/setup?${params.toString()}`;
}

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
  manualVoteFilters,
  meetingFilters,
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
  } =
    await getAdminDashboardData({ auditFilters });
  const approvedResultSnapshotIds = new Set(
    committeeApprovals.map((approval) => approval.result_snapshot_id),
  );
  const approvalBySnapshotId = new Map(
    committeeApprovals.map((approval) => [approval.result_snapshot_id, approval]),
  );
  const approvedMeetingIds = new Set(
    committeeApprovals.map((approval) => approval.meeting_id),
  );
  const pendingManualBallotsByMeetingId = new Map<
    string,
    typeof pendingManualBallots
  >();

  for (const ballot of pendingManualBallots) {
    const current = pendingManualBallotsByMeetingId.get(ballot.meeting_id) ?? [];

    pendingManualBallotsByMeetingId.set(ballot.meeting_id, [...current, ballot]);
  }
  const appRolesByProfile = new Map(
    profiles.map((profile) => [
      profile.id,
      appRoles.filter((role) => role.profile_id === profile.id),
    ]),
  );
  const pdfPreviewSnapshot =
    resultSnapshots.find((snapshot) => approvedResultSnapshotIds.has(snapshot.id)) ??
    resultSnapshots[0] ??
    null;
  const pdfPreviewPayload = pdfPreviewSnapshot
    ? getResultPayload(pdfPreviewSnapshot.payload_json)
    : null;
  const pdfPreviewApproval = pdfPreviewSnapshot
    ? approvalBySnapshotId.get(pdfPreviewSnapshot.id)
    : null;
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
  const auditSortBy = auditFilters?.sortBy ?? "time";
  const auditSortDirection = auditFilters?.sortDirection ?? "desc";
  const auditActors = [
    ...new Map(
      auditOptions
        .map((option) => option.profiles)
        .filter((profile): profile is NonNullable<typeof profile> =>
          Boolean(profile?.id),
        )
        .map((profile) => [
          profile.id,
          {
            id: profile.id,
            label: profile.full_name ?? profile.email ?? profile.id,
          },
        ]),
    ).values(),
  ].sort((left, right) => left.label.localeCompare(right.label));
  const auditActions = [...new Set(auditOptions.map((option) => option.action))]
    .filter(Boolean)
    .sort();
  const meetingTableFilters: Required<MeetingTableFilters> = {
    dir: meetingFilters?.dir ?? "asc",
    noType: meetingFilters?.noType ?? "",
    page: tablePage(meetingFilters?.page),
    perPage: tablePerPage(meetingFilters?.perPage),
    sort: meetingFilters?.sort ?? "title",
    status: meetingFilters?.status ?? "all",
    title: meetingFilters?.title ?? "",
  };
  const filteredMeetings = meetings.filter((meeting) => {
    const effectiveStatus = approvedMeetingIds.has(meeting.id)
      ? "approved"
      : meeting.status;
    const titleQuery = meetingTableFilters.title.trim().toLowerCase();
    const noTypeQuery = meetingTableFilters.noType.trim().toLowerCase();
    const matchesTitle = titleQuery
      ? meeting.title.toLowerCase().includes(titleQuery)
      : true;
    const matchesNoType = noTypeQuery
      ? [meeting.meeting_number ?? "", meeting.meeting_type ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(noTypeQuery)
      : true;
    const matchesStatus =
      meetingTableFilters.status === "all"
        ? true
        : effectiveStatus === meetingTableFilters.status;

    return matchesTitle && matchesNoType && matchesStatus;
  });
  const sortedMeetings = [...filteredMeetings].sort((left, right) => {
    const direction = meetingTableFilters.dir === "asc" ? 1 : -1;
    const leftStatus = approvedMeetingIds.has(left.id) ? "approved" : left.status;
    const rightStatus = approvedMeetingIds.has(right.id)
      ? "approved"
      : right.status;
    const leftValue =
      meetingTableFilters.sort === "status"
        ? leftStatus
        : meetingTableFilters.sort === "window"
          ? left.starts_at
          : meetingTableFilters.sort === "no_type"
            ? `${left.meeting_number ?? ""} ${left.meeting_type ?? ""}`
            : left.title;
    const rightValue =
      meetingTableFilters.sort === "status"
        ? rightStatus
        : meetingTableFilters.sort === "window"
          ? right.starts_at
          : meetingTableFilters.sort === "no_type"
            ? `${right.meeting_number ?? ""} ${right.meeting_type ?? ""}`
            : right.title;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const meetingTotal = sortedMeetings.length;
  const meetingTotalPages = Math.max(
    1,
    Math.ceil(meetingTotal / meetingTableFilters.perPage),
  );
  const meetingPage = Math.min(meetingTableFilters.page, meetingTotalPages);
  const meetingPageStart =
    meetingTotal === 0 ? 0 : (meetingPage - 1) * meetingTableFilters.perPage + 1;
  const meetingPageEnd = Math.min(
    meetingPage * meetingTableFilters.perPage,
    meetingTotal,
  );
  const pagedMeetings = sortedMeetings.slice(
    (meetingPage - 1) * meetingTableFilters.perPage,
    meetingPage * meetingTableFilters.perPage,
  );
  const meetingPageUrls = Object.fromEntries(
    Array.from({ length: meetingTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        meetingHref({ ...meetingTableFilters, page: pageNumber }),
      ],
    ),
  );
  const meetingPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      meetingHref({ ...meetingTableFilters, page: 1, perPage }),
    ]),
  );
  const meetingSortHref = (sort: Required<MeetingTableFilters>["sort"]) =>
    meetingHref({
      ...meetingTableFilters,
      dir:
        meetingTableFilters.sort === sort && meetingTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const meetingSortLabel = (sort: Required<MeetingTableFilters>["sort"]) =>
    meetingTableFilters.sort === sort
      ? meetingTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const resultTableFilters: Required<ResultTableFilters> = {
    approval: resultFilters?.approval ?? "all",
    dir: resultFilters?.dir ?? "asc",
    generated: resultFilters?.generated ?? "",
    meeting: resultFilters?.meeting ?? "",
    page: tablePage(resultFilters?.page),
    perPage: tablePerPage(resultFilters?.perPage),
    sort: resultFilters?.sort ?? "meeting",
  };
  const filteredResultSnapshots = resultSnapshots.filter((snapshot) => {
    const meetingQuery = resultTableFilters.meeting.trim().toLowerCase();
    const generatedQuery = resultTableFilters.generated.trim();
    const approvalStatus = approvedResultSnapshotIds.has(snapshot.id)
      ? "approved"
      : "pending";
    const matchesMeeting = meetingQuery
      ? (snapshot.meetings?.title ?? "").toLowerCase().includes(meetingQuery)
      : true;
    const matchesGenerated = generatedQuery
      ? snapshot.generated_at.slice(0, 10) === generatedQuery
      : true;
    const matchesApproval =
      resultTableFilters.approval === "all"
        ? true
        : approvalStatus === resultTableFilters.approval;

    return matchesMeeting && matchesGenerated && matchesApproval;
  });
  const sortedResultSnapshots = [...filteredResultSnapshots].sort((left, right) => {
    const direction = resultTableFilters.dir === "asc" ? 1 : -1;
    const leftApproval = approvedResultSnapshotIds.has(left.id)
      ? "approved"
      : "pending";
    const rightApproval = approvedResultSnapshotIds.has(right.id)
      ? "approved"
      : "pending";
    const leftValue =
      resultTableFilters.sort === "approval"
        ? leftApproval
        : resultTableFilters.sort === "generated"
          ? left.generated_at
          : left.meetings?.title ?? "";
    const rightValue =
      resultTableFilters.sort === "approval"
        ? rightApproval
        : resultTableFilters.sort === "generated"
          ? right.generated_at
          : right.meetings?.title ?? "";

    return leftValue.localeCompare(rightValue) * direction;
  });
  const resultTotal = sortedResultSnapshots.length;
  const resultTotalPages = Math.max(
    1,
    Math.ceil(resultTotal / resultTableFilters.perPage),
  );
  const resultPage = Math.min(resultTableFilters.page, resultTotalPages);
  const resultPageStart =
    resultTotal === 0 ? 0 : (resultPage - 1) * resultTableFilters.perPage + 1;
  const resultPageEnd = Math.min(
    resultPage * resultTableFilters.perPage,
    resultTotal,
  );
  const pagedResultSnapshots = sortedResultSnapshots.slice(
    (resultPage - 1) * resultTableFilters.perPage,
    resultPage * resultTableFilters.perPage,
  );
  const resultPageUrls = Object.fromEntries(
    Array.from({ length: resultTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        resultHref({ ...resultTableFilters, page: pageNumber }),
      ],
    ),
  );
  const resultPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      resultHref({ ...resultTableFilters, page: 1, perPage }),
    ]),
  );
  const resultSortHref = (sort: Required<ResultTableFilters>["sort"]) =>
    resultHref({
      ...resultTableFilters,
      dir:
        resultTableFilters.sort === sort && resultTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const resultSortLabel = (sort: Required<ResultTableFilters>["sort"]) =>
    resultTableFilters.sort === sort
      ? resultTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const emailTableFilters: Required<EmailTableFilters> = {
    created: emailFilters?.created ?? "",
    dir: emailFilters?.dir ?? "asc",
    page: tablePage(emailFilters?.page),
    perPage: tablePerPage(emailFilters?.perPage),
    recipient: emailFilters?.recipient ?? "",
    sort: emailFilters?.sort ?? "recipient",
    status: emailFilters?.status ?? "all",
  };
  const filteredEmailLogs = emailLogs.filter((log) => {
    const recipientQuery = emailTableFilters.recipient.trim().toLowerCase();
    const matchesRecipient = recipientQuery
      ? log.recipient_email.toLowerCase().includes(recipientQuery)
      : true;
    const matchesStatus =
      emailTableFilters.status === "all"
        ? true
        : log.status === emailTableFilters.status;
    const matchesCreated = emailTableFilters.created
      ? log.created_at.slice(0, 10) === emailTableFilters.created
      : true;

    return matchesRecipient && matchesStatus && matchesCreated;
  });
  const sortedEmailLogs = [...filteredEmailLogs].sort((left, right) => {
    const direction = emailTableFilters.dir === "asc" ? 1 : -1;
    const leftValue =
      emailTableFilters.sort === "created"
        ? left.created_at
        : emailTableFilters.sort === "status"
          ? left.status
          : left.recipient_email;
    const rightValue =
      emailTableFilters.sort === "created"
        ? right.created_at
        : emailTableFilters.sort === "status"
          ? right.status
          : right.recipient_email;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const emailTotal = sortedEmailLogs.length;
  const emailTotalPages = Math.max(
    1,
    Math.ceil(emailTotal / emailTableFilters.perPage),
  );
  const emailPage = Math.min(emailTableFilters.page, emailTotalPages);
  const emailPageStart =
    emailTotal === 0 ? 0 : (emailPage - 1) * emailTableFilters.perPage + 1;
  const emailPageEnd = Math.min(emailPage * emailTableFilters.perPage, emailTotal);
  const pagedEmailLogs = sortedEmailLogs.slice(
    (emailPage - 1) * emailTableFilters.perPage,
    emailPage * emailTableFilters.perPage,
  );
  const emailPageUrls = Object.fromEntries(
    Array.from({ length: emailTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        emailHref({ ...emailTableFilters, page: pageNumber }),
      ],
    ),
  );
  const emailPerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      emailHref({ ...emailTableFilters, page: 1, perPage }),
    ]),
  );
  const emailSortHref = (sort: Required<EmailTableFilters>["sort"]) =>
    emailHref({
      ...emailTableFilters,
      dir:
        emailTableFilters.sort === sort && emailTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const emailSortLabel = (sort: Required<EmailTableFilters>["sort"]) =>
    emailTableFilters.sort === sort
      ? emailTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
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
  const manualVoteTableFilters: Required<ManualVoteTableFilters> = {
    dir: manualVoteFilters?.dir ?? "asc",
    meeting: manualVoteFilters?.meeting ?? "",
    page: tablePage(manualVoteFilters?.page),
    perPage: tablePerPage(manualVoteFilters?.perPage),
    room: manualVoteFilters?.room ?? "",
    sort: manualVoteFilters?.sort ?? "meeting",
  };
  const pendingManualVoteIdentities = manualBallots.filter(
    (manualBallot) =>
      manualBallot.identity_status === "pending" ||
      manualBallot.status === "draft",
  );
  const manualVoteRows = manualBallots.flatMap((manualBallot) =>
    manualBallot.manual_ballot_answers.map((answer) => ({
      auditText: [
        manualBallot.source_label ?? "manual",
        manualBallot.identity_status ?? "legacy",
        manualBallot.voter_identity_text ??
          manualBallot.voter_profile_id ??
          manualBallot.audit_note ??
          "-",
      ].join(" / "),
      choiceText: answer.meeting_choices?.choice_text ?? "-",
      id: answer.id,
      meetingTitle: manualBallot.meetings?.title ?? "-",
      questionText: answer.meeting_questions?.question_text ?? "-",
      roomNumber: manualBallot.rooms?.room_number ?? "-",
    })),
  );
  const filteredManualVoteRows = manualVoteRows.filter((row) => {
    const meetingQuery = manualVoteTableFilters.meeting.trim().toLowerCase();
    const roomQuery = manualVoteTableFilters.room.trim().toLowerCase();
    const matchesMeeting = meetingQuery
      ? row.meetingTitle.toLowerCase().includes(meetingQuery)
      : true;
    const matchesRoom = roomQuery
      ? row.roomNumber.toLowerCase().includes(roomQuery)
      : true;

    return matchesMeeting && matchesRoom;
  });
  const sortedManualVoteRows = [...filteredManualVoteRows].sort((left, right) => {
    const direction = manualVoteTableFilters.dir === "asc" ? 1 : -1;
    const leftValue =
      manualVoteTableFilters.sort === "question"
        ? left.questionText
        : manualVoteTableFilters.sort === "room"
          ? left.roomNumber
          : left.meetingTitle;
    const rightValue =
      manualVoteTableFilters.sort === "question"
        ? right.questionText
        : manualVoteTableFilters.sort === "room"
          ? right.roomNumber
          : right.meetingTitle;

    return leftValue.localeCompare(rightValue) * direction;
  });
  const manualVoteTotal = sortedManualVoteRows.length;
  const manualVoteTotalPages = Math.max(
    1,
    Math.ceil(manualVoteTotal / manualVoteTableFilters.perPage),
  );
  const manualVotePage = Math.min(
    manualVoteTableFilters.page,
    manualVoteTotalPages,
  );
  const manualVotePageStart =
    manualVoteTotal === 0
      ? 0
      : (manualVotePage - 1) * manualVoteTableFilters.perPage + 1;
  const manualVotePageEnd = Math.min(
    manualVotePage * manualVoteTableFilters.perPage,
    manualVoteTotal,
  );
  const pagedManualVoteRows = sortedManualVoteRows.slice(
    (manualVotePage - 1) * manualVoteTableFilters.perPage,
    manualVotePage * manualVoteTableFilters.perPage,
  );
  const manualVotePageUrls = Object.fromEntries(
    Array.from({ length: manualVoteTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        manualVoteHref({ ...manualVoteTableFilters, page: pageNumber }),
      ],
    ),
  );
  const manualVotePerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      manualVoteHref({ ...manualVoteTableFilters, page: 1, perPage }),
    ]),
  );
  const manualVoteSortHref = (
    sort: Required<ManualVoteTableFilters>["sort"],
  ) =>
    manualVoteHref({
      ...manualVoteTableFilters,
      dir:
        manualVoteTableFilters.sort === sort &&
        manualVoteTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const manualVoteSortLabel = (
    sort: Required<ManualVoteTableFilters>["sort"],
  ) =>
    manualVoteTableFilters.sort === sort
      ? manualVoteTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";
  const committeeTableFilters: Required<CommitteeTableFilters> = {
    dir: committeeFilters?.dir ?? "asc",
    memberName: committeeFilters?.memberName ?? "",
    page: tablePage(committeeFilters?.page),
    perPage: tablePerPage(committeeFilters?.perPage),
    position: committeeFilters?.position ?? "",
    sort: committeeFilters?.sort ?? "name",
    status: committeeFilters?.status ?? "all",
  };
  const filteredCommitteeMembers = committeeMembers.filter((member) => {
    const nameQuery = committeeTableFilters.memberName.trim().toLowerCase();
    const positionQuery = committeeTableFilters.position.trim().toLowerCase();
    const status = member.active ? "active" : "inactive";
    const matchesName = nameQuery
      ? member.full_name.toLowerCase().includes(nameQuery)
      : true;
    const matchesPosition = positionQuery
      ? member.position_title.toLowerCase().includes(positionQuery)
      : true;
    const matchesStatus =
      committeeTableFilters.status === "all"
        ? true
        : status === committeeTableFilters.status;

    return matchesName && matchesPosition && matchesStatus;
  });
  const sortedCommitteeMembers = [...filteredCommitteeMembers].sort(
    (left, right) => {
      const direction = committeeTableFilters.dir === "asc" ? 1 : -1;
      const leftValue =
        committeeTableFilters.sort === "position"
          ? left.position_title
          : committeeTableFilters.sort === "status"
            ? left.active
              ? "active"
              : "inactive"
            : left.full_name;
      const rightValue =
        committeeTableFilters.sort === "position"
          ? right.position_title
          : committeeTableFilters.sort === "status"
            ? right.active
              ? "active"
              : "inactive"
            : right.full_name;

      return leftValue.localeCompare(rightValue) * direction;
    },
  );
  const committeeTotal = sortedCommitteeMembers.length;
  const committeeTotalPages = Math.max(
    1,
    Math.ceil(committeeTotal / committeeTableFilters.perPage),
  );
  const committeePage = Math.min(
    committeeTableFilters.page,
    committeeTotalPages,
  );
  const committeePageStart =
    committeeTotal === 0
      ? 0
      : (committeePage - 1) * committeeTableFilters.perPage + 1;
  const committeePageEnd = Math.min(
    committeePage * committeeTableFilters.perPage,
    committeeTotal,
  );
  const pagedCommitteeMembers = sortedCommitteeMembers.slice(
    (committeePage - 1) * committeeTableFilters.perPage,
    committeePage * committeeTableFilters.perPage,
  );
  const committeePageUrls = Object.fromEntries(
    Array.from({ length: committeeTotalPages }, (_, index) => index + 1).map(
      (pageNumber) => [
        String(pageNumber),
        committeeHref({ ...committeeTableFilters, page: pageNumber }),
      ],
    ),
  );
  const committeePerPageUrls = Object.fromEntries(
    [10, 25, 50, 100].map((perPage) => [
      String(perPage),
      committeeHref({ ...committeeTableFilters, page: 1, perPage }),
    ]),
  );
  const committeeSortHref = (sort: Required<CommitteeTableFilters>["sort"]) =>
    committeeHref({
      ...committeeTableFilters,
      dir:
        committeeTableFilters.sort === sort && committeeTableFilters.dir === "asc"
          ? "desc"
          : "asc",
      page: 1,
      sort,
    });
  const committeeSortLabel = (sort: Required<CommitteeTableFilters>["sort"]) =>
    committeeTableFilters.sort === sort
      ? committeeTableFilters.dir === "asc"
        ? " ↑"
        : " ↓"
      : "";

  return (
    <main className="min-h-screen px-6 py-8">
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

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("setup")}
          id="setup"
        >
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Juristic Person</h2>
          </div>
          <form action={saveCondoProfile} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <RequiredNote />
            </div>
            <input name="id" type="hidden" value={condoProfile?.id ?? ""} />
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Juristic person name</FieldLabel>
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={condoProfile?.juristic_name ?? ""}
                name="juristic_name"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <FieldLabel required>Project name</FieldLabel>
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={condoProfile?.project_name ?? ""}
                name="project_name"
                required
              />
            </label>
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.registration_no ?? ""}
              name="registration_no"
              placeholder="Registration no."
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.tax_id ?? ""}
              name="tax_id"
              placeholder="Tax ID"
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.manager_name ?? ""}
              name="manager_name"
              placeholder="Juristic manager"
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.phone ?? ""}
              name="phone"
              placeholder="Phone"
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.email ?? ""}
              name="email"
              placeholder="Email"
              type="email"
            />
            <label className="text-sm font-medium">
              Summary history limit
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={condoProfile?.summary_history_limit ?? 5}
                max={20}
                min={1}
                name="summary_history_limit"
                type="number"
              />
            </label>
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.address ?? ""}
              name="address"
              placeholder="Address"
            />
            <textarea
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              defaultValue={condoProfile?.document_footer ?? ""}
              name="document_footer"
              placeholder="Document footer"
              rows={2}
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <PendingSubmitButton
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                pendingLabel="Saving..."
                type="submit"
              >
                Save juristic profile
              </PendingSubmitButton>
              <FormResetButton label="Reset changes" />
            </div>
          </form>
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("storage")}
          id="storage"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderLock className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Document Storage</h2>
                <p className="text-sm text-[var(--muted)]">
                  Configure where private document references point to.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
              href="/admin/documents"
            >
              Open Documents
            </a>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Store only the local-drive root path or private Google Drive folder
            link here. Register individual document references and verification
            metadata in Documents.
          </p>

          <form action={saveAppSettings} className="grid gap-3 md:grid-cols-2">
            <input name="id" type="hidden" value={appSettings?.id ?? ""} />
            <label className="text-sm font-medium">
              Document storage provider
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={
                  appSettings?.document_storage_provider ?? "local_drive"
                }
                name="document_storage_provider"
              >
                <option value="local_drive">Local drive</option>
                <option value="google_drive">Google Drive</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Root path or private folder link
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                defaultValue={appSettings?.document_storage_root ?? ""}
                name="document_storage_root"
                placeholder="/secure/condovotes or private Drive folder URL"
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <PendingSubmitButton
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                pendingLabel="Saving..."
                type="submit"
              >
                Save document storage config
              </PendingSubmitButton>
              <FormResetButton label="Reset changes" />
            </div>
          </form>
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("audit")}
          id="audit"
        >
          <div className="mb-4 flex items-center gap-2">
            <History className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Business Audit Log</h2>
          </div>
          <AuditLogTable
            actions={auditActions}
            actors={auditActors}
            initialFilters={{
              actions: auditFilters?.actions ?? [],
              actor: auditFilters?.actorProfileId ?? "",
              dir: auditSortDirection,
              from: auditFilters?.dateFrom ?? "",
              page: auditLogPage,
              perPage: auditLogPerPage,
              sort: auditSortBy,
              to: auditFilters?.dateTo ?? "",
            }}
            initialPage={auditLogPage}
            initialPerPage={auditLogPerPage}
            initialRows={auditLogs}
            initialTotal={auditLogTotal}
          />
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("voting")}
          id="voting"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Manual Votes</h2>
                <p className="text-sm text-[var(--muted)]">
                  Import manual ballots and resolve manual/online conflicts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                href="/admin/voting/conflicts"
              >
                Review conflicts
              </a>
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                href="/admin/voting?mode=create&type=manual_vote"
              >
                Import manual vote
              </a>
            </div>
          </div>

          {pendingManualVoteIdentities.length > 0 ? (
            <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-amber-950">
                  Pending manual vote identities
                </h3>
                <p className="mt-1 text-xs text-amber-900">
                  These records block result generation and committee approval.
                  Link each pending identity to a registered profile before
                  continuing the result process.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-amber-200 text-amber-900">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Meeting</th>
                      <th className="py-2 pr-3 font-medium">Room</th>
                      <th className="py-2 pr-3 font-medium">Captured identity</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingManualVoteIdentities.map((manualBallot) => (
                      <tr
                        className="border-b border-amber-200 last:border-0"
                        key={manualBallot.id}
                      >
                        <td className="py-2 pr-3">
                          {manualBallot.meetings?.title ?? "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {manualBallot.rooms?.room_number ?? "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {manualBallot.voter_identity_text ??
                            manualBallot.audit_note ??
                            "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {manualBallot.identity_status} / {manualBallot.status}
                        </td>
                        <td className="py-2">
                          <a
                            className="rounded-md border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900"
                            href={`/admin/voting?mode=edit&type=manual_vote_identity&id=${manualBallot.id}`}
                          >
                            Link profile
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter manual vote rows by meeting and room.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-12">
              <input
                name="sort"
                type="hidden"
                value={manualVoteTableFilters.sort}
              />
              <input
                name="dir"
                type="hidden"
                value={manualVoteTableFilters.dir}
              />
              <input
                name="perPage"
                type="hidden"
                value={manualVoteTableFilters.perPage}
              />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                Meeting
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={manualVoteTableFilters.meeting}
                  name="meeting"
                  placeholder="Search meeting"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                Room
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={manualVoteTableFilters.room}
                  name="room"
                  placeholder="Search room"
                />
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-4">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/voting"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {manualVotePageStart}-{manualVotePageEnd} of{" "}
                {manualVoteTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: manualVoteTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={manualVotePageUrls}
                value={manualVotePage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {manualVoteTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
                urlByValue={manualVotePerPageUrls}
                value={manualVoteTableFilters.perPage}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    <a href={manualVoteSortHref("meeting")}>
                      Meeting{manualVoteSortLabel("meeting")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={manualVoteSortHref("room")}>
                      Room{manualVoteSortLabel("room")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={manualVoteSortHref("question")}>
                      Question{manualVoteSortLabel("question")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">Choice</th>
                  <th className="py-2 font-medium">Audit</th>
                </tr>
              </thead>
              <tbody>
                {pagedManualVoteRows.map((row) => (
                  <tr className="border-b border-[var(--border)]" key={row.id}>
                    <td className="py-2 pr-3">{row.meetingTitle}</td>
                    <td className="py-2 pr-3">{row.roomNumber}</td>
                    <td className="py-2 pr-3">{row.questionText}</td>
                    <td className="py-2 pr-3">{row.choiceText}</td>
                    <td className="py-2">{row.auditText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagedManualVoteRows.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No manual vote rows match the selected criteria.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a
              aria-disabled={manualVotePage <= 1}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                manualVotePage <= 1 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              href={manualVoteHref({
                ...manualVoteTableFilters,
                page: Math.max(1, manualVotePage - 1),
              })}
            >
              Previous
            </a>
            <div className="text-sm text-[var(--muted)]">
              {manualVotePageStart}-{manualVotePageEnd} / {manualVoteTotal}
            </div>
            <a
              aria-disabled={manualVotePage >= manualVoteTotalPages}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                manualVotePage >= manualVoteTotalPages
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
              href={manualVoteHref({
                ...manualVoteTableFilters,
                page: Math.min(manualVoteTotalPages, manualVotePage + 1),
              })}
            >
              Next
            </a>
          </div>
          {drawer?.mode === "create" && drawer.type === "manual_vote" ? (
            <AdminCrudDrawer
              closeHref="/admin/voting"
              summary={["Manual vote entry setup"]}
              title="Import manual vote"
            >
              <form action={startManualVoteImport} className="grid gap-3">
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Meeting</FieldLabel>
                  <select
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="meeting_id"
                    required
                  >
                    <option value="">Select meeting</option>
                    {meetings
                      .filter((meeting) => meeting.status !== "archived")
                      .map((meeting) => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Room</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="room_id"
                    required
                  >
                    <option value="">Select room</option>
                    {rooms
                      .filter((room) => room.active)
                      .map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_number}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Voter profile
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="voter_profile_id"
                  >
                    <option value="">Use pending free-text identity</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name ?? profile.email} ({profile.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Pending voter identity
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="voter_identity_text"
                    placeholder="Name on paper ballot when profile is not registered yet"
                  />
                </label>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  If only a free-text identity is entered, the manual vote is
                  saved as draft/pending and will not be used in result
                  calculation until the voter is registered and linked to a
                  profile.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Opening..."
                    type="submit"
                  >
                    Continue to vote form
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/voting"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            </AdminCrudDrawer>
          ) : null}
          {drawer?.mode === "edit" && drawer.type === "manual_vote_identity"
            ? pendingManualVoteIdentities
                .filter((manualBallot) => manualBallot.id === drawer.id)
                .map((manualBallot) => (
                  <AdminCrudDrawer
                    closeHref="/admin/voting"
                    key={manualBallot.id}
                    summary={[
                      `Meeting: ${manualBallot.meetings?.title ?? "-"}`,
                      `Room: ${manualBallot.rooms?.room_number ?? "-"}`,
                      `Captured: ${
                        manualBallot.voter_identity_text ??
                        manualBallot.audit_note ??
                        "-"
                      }`,
                    ]}
                    title="Resolve manual vote identity"
                  >
                    <form action={resolveManualBallotIdentity} className="grid gap-3">
                      <RequiredNote />
                      <input name="id" type="hidden" value={manualBallot.id} />
                      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Select the registered profile that matches the paper ballot
                        identity. After saving, this manual vote becomes submitted
                        and can be used in result generation and committee approval.
                      </p>
                      <label className="grid gap-1 text-sm font-medium">
                        <FieldLabel required>Voter profile</FieldLabel>
                        <select
                          autoFocus
                          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          name="voter_profile_id"
                          required
                        >
                          <option value="">Select profile</option>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.full_name ?? profile.email} ({profile.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <ConfirmSubmitButton
                          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                          confirmMessage={`Link pending manual vote identity "${manualBallot.voter_identity_text ?? manualBallot.audit_note ?? "this identity"}" to the selected profile? This makes the manual vote eligible for result calculation.`}
                          pendingLabel="Saving..."
                          type="submit"
                        >
                          Link profile
                        </ConfirmSubmitButton>
                        <a
                          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                          href="/admin/voting"
                        >
                          Cancel
                        </a>
                      </div>
                    </form>
                  </AdminCrudDrawer>
                ))
            : null}

        </section>

        <section
          className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("committee")}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Committee Members</h2>
                <p className="text-sm text-[var(--muted)]">
                  Maintain active committee records for formal meeting documents.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/setup?tab=committee&mode=create&type=committee_member"
            >
              Add committee member
            </a>
          </div>

          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter committee members by name, position, and status.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-12">
              <input name="tab" type="hidden" value="committee" />
              <input
                name="sort"
                type="hidden"
                value={committeeTableFilters.sort}
              />
              <input name="dir" type="hidden" value={committeeTableFilters.dir} />
              <input
                name="perPage"
                type="hidden"
                value={committeeTableFilters.perPage}
              />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Name
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={committeeTableFilters.memberName}
                  name="memberName"
                  placeholder="Search name"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Position
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={committeeTableFilters.position}
                  name="position"
                  placeholder="Search position"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Status
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={committeeTableFilters.status}
                  name="status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/setup?tab=committee"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {committeePageStart}-{committeePageEnd} of{" "}
                {committeeTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: committeeTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={committeePageUrls}
                value={committeePage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {committeeTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
                urlByValue={committeePerPageUrls}
                value={committeeTableFilters.perPage}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    <a href={committeeSortHref("name")}>
                      Name{committeeSortLabel("name")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={committeeSortHref("position")}>
                      Position{committeeSortLabel("position")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">Term</th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={committeeSortHref("status")}>
                      Status{committeeSortLabel("status")}
                    </a>
                  </th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedCommitteeMembers.map((member) => (
                  <tr className="border-b border-[var(--border)]" key={member.id}>
                    <td className="py-2 pr-3">{member.full_name}</td>
                    <td className="py-2 pr-3">{member.position_title}</td>
                    <td className="py-2 pr-3">
                      {member.term_starts_at ?? "Not set"} -{" "}
                      {member.term_ends_at ?? "Current"}
                    </td>
                    <td className="py-2 pr-3">
                      {member.active ? "Active" : "Inactive"}
                    </td>
                    <td className="py-2">
                      {member.active ? (
                        <form action={deactivateCommitteeMember}>
                          <input name="id" type="hidden" value={member.id} />
                          <ConfirmSubmitButton
                            className="text-sm font-medium text-red-700"
                            confirmMessage={`Deactivate committee member "${member.full_name}"? This member will no longer appear as active for formal meeting documents.`}
                            pendingLabel="Deactivating..."
                            type="submit"
                          >
                            Deactivate
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagedCommitteeMembers.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No committee members match the selected criteria.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a
              aria-disabled={committeePage <= 1}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                committeePage <= 1 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              href={committeeHref({
                ...committeeTableFilters,
                page: Math.max(1, committeePage - 1),
              })}
            >
              Previous
            </a>
            <div className="text-sm text-[var(--muted)]">
              {committeePageStart}-{committeePageEnd} / {committeeTotal}
            </div>
            <a
              aria-disabled={committeePage >= committeeTotalPages}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                committeePage >= committeeTotalPages
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
              href={committeeHref({
                ...committeeTableFilters,
                page: Math.min(committeeTotalPages, committeePage + 1),
              })}
            >
              Next
            </a>
          </div>
          {drawer?.mode === "create" && drawer.type === "committee_member" ? (
            <AdminCrudDrawer
              closeHref="/admin/setup?tab=committee"
              summary={["New committee member"]}
              title="Add committee member"
            >
              <form
                action={createCommitteeMember}
                className="grid gap-3"
              >
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  Profile
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="profile_id"
                  >
                    <option value="">Profile optional</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name} ({profile.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Committee name</FieldLabel>
                  <input
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="full_name"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Position</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="position_title"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Display order
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue={0}
                    min={0}
                    name="display_order"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Term starts
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="term_starts_at"
                    type="date"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Term ends
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="term_ends_at"
                    type="date"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Add committee member
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/setup?tab=committee"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            </AdminCrudDrawer>
          ) : null}
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("meetings")}
          id="meetings"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Meetings</h2>
                <p className="text-sm text-[var(--muted)]">
                  Maintain meeting master data and voting windows.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/meetings?tab=meetings&mode=create&type=meeting"
            >
              Add meeting
            </a>
          </div>

          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter meetings by title, meeting number/type, and status.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-12">
              <input name="tab" type="hidden" value="meetings" />
              <input name="sort" type="hidden" value={meetingTableFilters.sort} />
              <input name="dir" type="hidden" value={meetingTableFilters.dir} />
              <input
                name="perPage"
                type="hidden"
                value={meetingTableFilters.perPage}
              />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                Title
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={meetingTableFilters.title}
                  name="title"
                  placeholder="Search title"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                No./Type
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={meetingTableFilters.noType}
                  name="noType"
                  placeholder="Search meeting no. or type"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-2">
                Status
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={meetingTableFilters.status}
                  name="status"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                  <option value="approved">Approved</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-2">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/meetings?tab=meetings"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {meetingPageStart}-{meetingPageEnd} of {meetingTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: meetingTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={meetingPageUrls}
                value={meetingPage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {meetingTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
                urlByValue={meetingPerPageUrls}
                value={meetingTableFilters.perPage}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    <a href={meetingSortHref("title")}>
                      Title{meetingSortLabel("title")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={meetingSortHref("no_type")}>
                      No./Type{meetingSortLabel("no_type")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={meetingSortHref("window")}>
                      Window{meetingSortLabel("window")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={meetingSortHref("status")}>
                      Status{meetingSortLabel("status")}
                    </a>
                  </th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedMeetings.map((meeting) => {
                  const hasApprovedResult = approvedMeetingIds.has(meeting.id);
                  const pendingManualCount =
                    pendingManualBallotsByMeetingId.get(meeting.id)?.length ?? 0;

                  return (
                    <tr className="border-b border-[var(--border)]" key={meeting.id}>
                      <td className="py-2 pr-3">{meeting.title}</td>
                      <td className="py-2 pr-3">
                        {meeting.meeting_number ?? "-"} / {meeting.meeting_type}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDateTime(meeting.starts_at)} -{" "}
                        {formatDateTime(meeting.ends_at)}
                      </td>
                      <td className="py-2 pr-3">
                        {hasApprovedResult ? "approved" : meeting.status}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-3">
                          {meeting.status === "draft" ? (
                            <form action={publishMeeting}>
                              <input name="id" type="hidden" value={meeting.id} />
                              <PendingSubmitButton
                                className="text-sm font-medium text-[var(--primary)]"
                                pendingLabel="Publishing..."
                                type="submit"
                              >
                                Publish
                              </PendingSubmitButton>
                            </form>
                          ) : null}
                          {meeting.status !== "archived" ? (
                            <form action={archiveMeeting}>
                              <input name="id" type="hidden" value={meeting.id} />
                              <ConfirmSubmitButton
                                className="text-sm font-medium text-red-700"
                                confirmMessage={`Archive meeting "${meeting.title}"? This meeting will be hidden from active meeting workflows and cannot be published again without an admin change.`}
                                pendingLabel="Archiving..."
                                type="submit"
                              >
                                Archive
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                          {(meeting.status === "published" ||
                            meeting.status === "closed") &&
                          !hasApprovedResult ? (
                            pendingManualCount > 0 ? (
                              <a
                                className="text-sm font-medium text-amber-700"
                                href="/admin/voting"
                              >
                                Resolve {pendingManualCount} pending manual vote
                              </a>
                            ) : (
                              <form action={generateResultSnapshot}>
                                <input name="id" type="hidden" value={meeting.id} />
                                <PendingSubmitButton
                                  className="text-sm font-medium text-[var(--primary)]"
                                  pendingLabel="Generating..."
                                  type="submit"
                                >
                                  Generate result
                                </PendingSubmitButton>
                              </form>
                            )
                          ) : null}
                          {hasApprovedResult ? (
                            <span className="text-sm text-[var(--muted)]">
                              Result locked
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pagedMeetings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No meetings match the selected criteria.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a
              aria-disabled={meetingPage <= 1}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                meetingPage <= 1 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              href={meetingHref({
                ...meetingTableFilters,
                page: Math.max(1, meetingPage - 1),
              })}
            >
              Previous
            </a>
            <div className="text-sm text-[var(--muted)]">
              {meetingPageStart}-{meetingPageEnd} / {meetingTotal}
            </div>
            <a
              aria-disabled={meetingPage >= meetingTotalPages}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                meetingPage >= meetingTotalPages
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
              href={meetingHref({
                ...meetingTableFilters,
                page: Math.min(meetingTotalPages, meetingPage + 1),
              })}
            >
              Next
            </a>
          </div>
          {meetings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No meetings have been created yet.
            </p>
          ) : null}
          {drawer?.mode === "create" && drawer.type === "meeting" ? (
            <AdminCrudDrawer
              closeHref="/admin/meetings?tab=meetings"
              summary={["New meeting"]}
              title="Add meeting"
            >
              <form action={createMeeting} className="grid gap-3">
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Meeting title</FieldLabel>
                  <input
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="title"
                    required
                  />
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="video_url"
                  placeholder="Video URL"
                  type="url"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="meeting_number"
                  placeholder="Meeting no."
                />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Meeting type</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue="online_vote"
                    name="meeting_type"
                    required
                  >
                    <option value="online_vote">Online vote</option>
                    <option value="agm">AGM</option>
                    <option value="egm">EGM</option>
                    <option value="committee">Committee</option>
                  </select>
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="fiscal_year"
                  placeholder="Fiscal year"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="location"
                  placeholder="Location / platform"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="chairperson_name"
                  placeholder="Chairperson"
                />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Quorum rule</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue="one_fourth_total_ownership"
                    name="quorum_rule"
                    required
                  >
                    <option value="one_fourth_total_ownership">
                      Quorum: 1/4 ownership
                    </option>
                    <option value="not_required_second_call">
                      Second call: no quorum
                    </option>
                    <option value="committee_policy">Committee policy</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Starts</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="starts_at"
                    required
                    step={600}
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Ends</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="ends_at"
                    required
                    step={600}
                    type="datetime-local"
                  />
                </label>
                <textarea
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="description"
                  placeholder="Description"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Add meeting
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/meetings?tab=meetings"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            </AdminCrudDrawer>
          ) : null}
        </section>

        <section
          className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("questions")}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Questions And Choices</h2>
                <p className="text-sm text-[var(--muted)]">
                  Add agenda questions, then manage choices on each question row.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/meetings?tab=questions&mode=create&type=question"
            >
              Add question
            </a>
          </div>

          <div className="grid gap-4">
            {questions.map((question) => (
              <div
                className="rounded-md border border-[var(--border)] p-4"
                key={question.id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm text-[var(--muted)]">
                      {question.meetings?.title ?? "-"} / agenda{" "}
                      {question.agenda_no ?? "-"} / {question.question_type} /{" "}
                      {question.resolution_type} / {question.required_threshold}
                    </div>
                    {question.agenda_title ? (
                      <div className="mt-1 text-sm font-medium">
                        {question.agenda_title}
                      </div>
                    ) : null}
                    <h3 className="mt-1 font-semibold">{question.question_text}</h3>
                    {question.requires_land_office_registration ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Requires land office registration
                      </div>
                    ) : null}
                  </div>
                  <form action={deleteMeetingQuestion}>
                    <input name="id" type="hidden" value={question.id} />
                    <ConfirmSubmitButton
                      className="text-sm font-medium text-red-700"
                      confirmMessage={`Delete question "${question.question_text}"? This removes the agenda question and its configured choices from the meeting setup.`}
                      pendingLabel="Deleting..."
                      type="submit"
                    >
                      Delete question
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <form
                  action={createMeetingChoice}
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_160px]"
                >
                  <input name="question_id" type="hidden" value={question.id} />
                  <label className="grid gap-1 text-sm font-medium">
                    <FieldLabel required>Choice</FieldLabel>
                    <input
                      className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                      name="choice_text"
                      required
                    />
                  </label>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue={0}
                    min={0}
                    name="display_order"
                    placeholder="Order"
                    type="number"
                  />
                  <div className="flex flex-wrap gap-2">
                    <PendingSubmitButton
                      className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                      pendingLabel="Adding..."
                      type="submit"
                    >
                      Add choice
                    </PendingSubmitButton>
                    <FormResetButton label="Clear form" />
                  </div>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.meeting_choices
                    .sort((left, right) => left.display_order - right.display_order)
                    .map((choice) => (
                      <form
                        action={deleteMeetingChoice}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                        key={choice.id}
                      >
                        <span>{choice.choice_text}</span>
                        <input name="id" type="hidden" value={choice.id} />
                        <ConfirmSubmitButton
                          className="font-medium text-red-700"
                          confirmMessage={`Delete choice "${choice.choice_text}"? Existing ballot setup for this choice will no longer be available.`}
                          pendingLabel="Deleting..."
                          type="submit"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    ))}
                </div>
              </div>
            ))}
          </div>
          {questions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No meeting questions have been created yet.
            </p>
          ) : null}
          {drawer?.mode === "create" && drawer.type === "question" ? (
            <AdminCrudDrawer
              closeHref="/admin/meetings?tab=questions"
              summary={["New agenda question"]}
              title="Add question"
            >
              <form action={createMeetingQuestion} className="grid gap-3">
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Meeting</FieldLabel>
                  <select
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="meeting_id"
                    required
                  >
                    <option value="">Select meeting</option>
                    {meetings
                      .filter((meeting) => meeting.status !== "archived")
                      .map((meeting) => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title}
                        </option>
                      ))}
                  </select>
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="agenda_no"
                  placeholder="Agenda no."
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="agenda_title"
                  placeholder="Agenda title"
                />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Question</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="question_text"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Question type</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="question_type"
                    required
                  >
                    <option value="single_choice">Single choice</option>
                    <option value="multiple_choice">Multiple choice</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Resolution type</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue="ordinary"
                    name="resolution_type"
                    required
                  >
                    <option value="ordinary">Ordinary</option>
                    <option value="special">Special</option>
                    <option value="informational">Informational</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Required threshold</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue="majority_submitted"
                    name="required_threshold"
                    required
                  >
                    <option value="majority_submitted">Majority submitted</option>
                    <option value="one_third_total">1/3 total ownership</option>
                    <option value="half_total">1/2 total ownership</option>
                    <option value="three_fourths_total">3/4 total ownership</option>
                    <option value="informational">Informational</option>
                  </select>
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  defaultValue={0}
                  min={0}
                  name="display_order"
                  placeholder="Order"
                  type="number"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input defaultChecked name="required" type="checkbox" />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input name="requires_land_office_registration" type="checkbox" />
                  Land office registration
                </label>
                <textarea
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="legal_note"
                  placeholder="Legal / admin note"
                  rows={2}
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Add question
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/meetings?tab=questions"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            </AdminCrudDrawer>
          ) : null}
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("results")}
          id="results"
        >
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Results</h2>
          </div>
          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter result snapshots by meeting, generated date, and approval.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-12">
              <input name="sort" type="hidden" value={resultTableFilters.sort} />
              <input name="dir" type="hidden" value={resultTableFilters.dir} />
              <input
                name="perPage"
                type="hidden"
                value={resultTableFilters.perPage}
              />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                Meeting
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={resultTableFilters.meeting}
                  name="meeting"
                  placeholder="Search meeting"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Generated
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={resultTableFilters.generated}
                  name="generated"
                  type="date"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Approval
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={resultTableFilters.approval}
                  name="approval"
                >
                  <option value="all">All approvals</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-2">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/results"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {resultPageStart}-{resultPageEnd} of {resultTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: resultTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={resultPageUrls}
                value={resultPage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {resultTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
                urlByValue={resultPerPageUrls}
                value={resultTableFilters.perPage}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    <a href={resultSortHref("meeting")}>
                      Meeting{resultSortLabel("meeting")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={resultSortHref("generated")}>
                      Generated{resultSortLabel("generated")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">Submitted</th>
                  <th className="py-2 pr-3 font-medium">Ownership</th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={resultSortHref("approval")}>
                      Approval{resultSortLabel("approval")}
                    </a>
                  </th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedResultSnapshots.map((snapshot) => {
                  const totals = getResultTotals(snapshot.payload_json);
                  const approved = approvedResultSnapshotIds.has(snapshot.id);
                  const meetingApproved = approvedMeetingIds.has(
                    snapshot.meeting_id,
                  );
                  const pendingManualCount =
                    pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                      ?.length ?? 0;
                  const selected =
                    drawer?.mode === "edit" &&
                    drawer.type === "result_approval" &&
                    drawer.id === snapshot.id;

                  return (
                    <tr
                      className={[
                        "border-b border-[var(--border)]",
                        selected
                          ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                          : "",
                      ].join(" ")}
                      key={snapshot.id}
                    >
                      <td className="py-2 pr-3">
                        {snapshot.meetings?.title ?? "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDateTime(snapshot.generated_at)}
                      </td>
                      <td className="py-2 pr-3">
                        {totals?.submitted_ballots ?? 0} /{" "}
                        {totals?.eligible_voters ?? 0}
                      </td>
                      <td className="py-2 pr-3">
                        {formatPercent(totals?.submitted_ownership)} /{" "}
                        {formatPercent(totals?.total_eligible_ownership)}
                      </td>
                      <td className="py-2 pr-3">
                        {approved ? "approved" : "pending"}
                      </td>
                      <td className="py-2">
                        {!meetingApproved && pendingManualCount === 0 ? (
                          <a
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                            href={`/admin/results?mode=edit&type=result_approval&id=${snapshot.id}`}
                          >
                            Approve result
                          </a>
                        ) : null}
                        {!meetingApproved && pendingManualCount > 0 ? (
                          <a
                            className="text-sm font-medium text-amber-700"
                            href="/admin/voting"
                          >
                            Resolve {pendingManualCount} pending manual vote
                          </a>
                        ) : null}
                        {meetingApproved && !approved ? (
                          <span className="text-sm text-[var(--muted)]">
                            Locked by approved result
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pagedResultSnapshots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No result snapshots match the selected criteria.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a
              aria-disabled={resultPage <= 1}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                resultPage <= 1 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              href={resultHref({
                ...resultTableFilters,
                page: Math.max(1, resultPage - 1),
              })}
            >
              Previous
            </a>
            <div className="text-sm text-[var(--muted)]">
              {resultPageStart}-{resultPageEnd} / {resultTotal}
            </div>
            <a
              aria-disabled={resultPage >= resultTotalPages}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                resultPage >= resultTotalPages
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
              href={resultHref({
                ...resultTableFilters,
                page: Math.min(resultTotalPages, resultPage + 1),
              })}
            >
              Next
            </a>
          </div>
          {drawer?.mode === "edit" && drawer.type === "result_approval"
            ? resultSnapshots
                .filter((snapshot) => snapshot.id === drawer.id)
                .map((snapshot) => (
                  <AdminCrudDrawer
                    closeHref="/admin/results"
                    key={snapshot.id}
                    summary={[
                      `Meeting: ${snapshot.meetings?.title ?? "-"}`,
                      `Generated: ${formatDateTime(snapshot.generated_at)}`,
                    ]}
                    title="Approve result"
                  >
                    <form action={approveResultSnapshot} className="grid gap-3">
                      <input
                        name="meeting_id"
                        type="hidden"
                        value={snapshot.meeting_id}
                      />
                      <input
                        name="result_snapshot_id"
                        type="hidden"
                        value={snapshot.id}
                      />
                      {(pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                        ?.length ?? 0) > 0 ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          Resolve{" "}
                          {pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                            ?.length ?? 0}{" "}
                          pending manual vote identity record(s) before committee
                          approval. Go to{" "}
                          <a className="font-medium underline" href="/admin/voting">
                            Admin &gt; Voting &gt; Manual votes
                          </a>{" "}
                          to fix them.
                        </div>
                      ) : null}
                      <label className="grid gap-1 text-sm font-medium">
                        Approval / conflict notes
                        <textarea
                          autoFocus
                          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          name="notes"
                          rows={4}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {(pendingManualBallotsByMeetingId.get(snapshot.meeting_id)
                          ?.length ?? 0) > 0 ? (
                          <button
                            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] opacity-60"
                            disabled
                            type="button"
                          >
                            Approval blocked
                          </button>
                        ) : (
                          <ConfirmSubmitButton
                            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                            confirmMessage={`Approve result for "${snapshot.meetings?.title ?? "this meeting"}"? This locks the approved result snapshot as the source of truth.`}
                            pendingLabel="Saving..."
                            type="submit"
                          >
                            Approve result
                          </ConfirmSubmitButton>
                        )}
                        <FormResetButton label="Clear form" />
                        <a
                          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                          href="/admin/results"
                        >
                          Cancel
                        </a>
                      </div>
                    </form>
                  </AdminCrudDrawer>
                ))
            : null}
          {pdfPreviewSnapshot && pdfPreviewPayload ? (
            <div
              className="mt-6 border-t border-[var(--border)] pt-5"
              id="mock-pdf-summary"
            >
              <div className="mb-4 flex items-center gap-2">
                <FileText className="text-[var(--primary)]" size={20} />
                <div>
                  <h3 className="text-base font-semibold">
                    Mock PDF Result Summary
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    Print-ready preview for juristic person review. Production
                    PDF generation remains a Tail V1 task.
                  </p>
                </div>
              </div>
              <article className="bg-white p-6 text-sm leading-6 shadow-sm ring-1 ring-[var(--border)]">
                <header className="border-b border-[var(--border)] pb-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Condominium juristic person result summary
                  </div>
                  <h4 className="mt-2 text-xl font-semibold">
                    {condoProfile?.juristic_name ??
                      condoProfile?.project_name ??
                      "Condominium Juristic Person"}
                  </h4>
                  <p className="text-[var(--muted)]">
                    {condoProfile?.project_name ?? "-"}
                  </p>
                </header>

                <dl className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <dt className="font-medium">Meeting</dt>
                    <dd>
                      {pdfPreviewPayload.meeting?.title ??
                        pdfPreviewSnapshot.meetings?.title ??
                        "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Meeting no. / fiscal year</dt>
                    <dd>
                      {pdfPreviewPayload.meeting?.meeting_number ?? "-"} /{" "}
                      {pdfPreviewPayload.meeting?.fiscal_year ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Meeting date</dt>
                    <dd>
                      {pdfPreviewPayload.meeting?.starts_at
                        ? formatDateTime(pdfPreviewPayload.meeting.starts_at)
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Location</dt>
                    <dd>{pdfPreviewPayload.meeting?.location ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Registration / tax ID</dt>
                    <dd>
                      {condoProfile?.registration_no ?? "-"} /{" "}
                      {condoProfile?.tax_id ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Chairperson</dt>
                    <dd>{pdfPreviewPayload.meeting?.chairperson_name ?? "-"}</dd>
                  </div>
                </dl>

                <section className="mt-5">
                  <h5 className="font-semibold">Voting Totals</h5>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <tbody>
                        <tr className="border-b border-[var(--border)]">
                          <th className="py-2 pr-3 font-medium">
                            Eligible voters
                          </th>
                          <td className="py-2">
                            {pdfPreviewPayload.totals?.eligible_voters ?? 0}
                          </td>
                        </tr>
                        <tr className="border-b border-[var(--border)]">
                          <th className="py-2 pr-3 font-medium">
                            Submitted ballots
                          </th>
                          <td className="py-2">
                            {pdfPreviewPayload.totals?.submitted_ballots ?? 0}
                          </td>
                        </tr>
                        <tr className="border-b border-[var(--border)]">
                          <th className="py-2 pr-3 font-medium">
                            Online / manual ballots
                          </th>
                          <td className="py-2">
                            {pdfPreviewPayload.totals?.online_ballots ?? 0} /{" "}
                            {pdfPreviewPayload.totals?.manual_ballots ?? 0}
                          </td>
                        </tr>
                        <tr>
                          <th className="py-2 pr-3 font-medium">
                            Submitted / eligible ownership
                          </th>
                          <td className="py-2">
                            {formatPercent(
                              pdfPreviewPayload.totals?.submitted_ownership,
                            )}{" "}
                            /{" "}
                            {formatPercent(
                              pdfPreviewPayload.totals
                                ?.total_eligible_ownership,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="mt-5">
                  <h5 className="font-semibold">Agenda Results</h5>
                  <div className="mt-2 space-y-4">
                    {pdfPreviewPayload.questions?.map((question, index) => (
                      <div
                        className="border-b border-[var(--border)] pb-3 last:border-0"
                        key={`${question.agenda_no ?? index}-${question.text}`}
                      >
                        <div className="font-medium">
                          {question.agenda_no ?? `Item ${index + 1}`}{" "}
                          {question.agenda_title ?? question.text ?? "-"}
                        </div>
                        <div className="text-[var(--muted)]">
                          Resolution: {question.resolution_type ?? "-"}
                          {question.required_threshold
                            ? `, threshold ${formatPercent(
                                question.required_threshold,
                              )}`
                            : ""}
                          {question.requires_land_office_registration
                            ? ", land office registration required"
                            : ""}
                        </div>
                        <table className="mt-2 w-full border-collapse text-left">
                          <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                            <tr>
                              <th className="py-1 pr-3 font-medium">Choice</th>
                              <th className="py-1 pr-3 font-medium">Rooms</th>
                              <th className="py-1 pr-3 font-medium">
                                Ownership
                              </th>
                              <th className="py-1 font-medium">
                                Submitted %
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {question.choices?.map((choice) => (
                              <tr
                                className="border-b border-[var(--border)] last:border-0"
                                key={choice.text}
                              >
                                <td className="py-1 pr-3">
                                  {choice.text ?? "-"}
                                </td>
                                <td className="py-1 pr-3">
                                  {choice.vote_count ?? 0}
                                </td>
                                <td className="py-1 pr-3">
                                  {formatPercent(choice.ownership)}
                                </td>
                                <td className="py-1">
                                  {formatPercent(
                                    choice.percent_of_submitted_ownership,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {question.legal_note ? (
                          <p className="mt-2 text-[var(--muted)]">
                            Legal note: {question.legal_note}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-5">
                  <h5 className="font-semibold">Conflict And Audit Notes</h5>
                  <p>
                    Source conflicts:{" "}
                    {pdfPreviewPayload.totals?.source_conflicts ?? 0}; resolved:{" "}
                    {pdfPreviewPayload.totals?.resolved_source_conflicts ?? 0}.
                  </p>
                  {pdfPreviewPayload.vote_source_audit?.conflicts?.length ? (
                    <ul className="mt-2 list-disc pl-5">
                      {pdfPreviewPayload.vote_source_audit.conflicts.map(
                        (conflict, index) => (
                          <li key={`${conflict.chosen_source}-${index}`}>
                            Source: {conflict.chosen_source ?? "-"}; remark:{" "}
                            {conflict.conflict_remark ?? "-"}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-[var(--muted)]">
                      No manual/online source conflict recorded for this
                      snapshot.
                    </p>
                  )}
                </section>

                <section className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-2">
                  <div>
                    <h5 className="font-semibold">Committee / approver</h5>
                    <p>
                      {pdfPreviewApproval?.profiles?.full_name ??
                        pdfPreviewPayload.meeting?.chairperson_name ??
                        "-"}
                    </p>
                    <p className="text-[var(--muted)]">
                      Approved:{" "}
                      {pdfPreviewApproval?.approved_at
                        ? formatDateTime(pdfPreviewApproval.approved_at)
                        : "Pending"}
                    </p>
                    <p className="text-[var(--muted)]">
                      Notes: {pdfPreviewApproval?.notes ?? "-"}
                    </p>
                  </div>
                  <div>
                    <h5 className="font-semibold">Committee members</h5>
                    <p>
                      {committeeMembers
                        .filter((member) => member.active)
                        .map((member) => member.full_name)
                        .join(", ") || "-"}
                    </p>
                  </div>
                </section>

                <footer className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  Generated:{" "}
                  {pdfPreviewPayload.generated_at
                    ? formatDateTime(pdfPreviewPayload.generated_at)
                    : formatDateTime(pdfPreviewSnapshot.generated_at)}
                  {condoProfile?.document_footer
                    ? ` | ${condoProfile.document_footer}`
                    : ""}
                </footer>
              </article>
            </div>
          ) : null}
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("email")}
          id="email"
        >
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Email Queue</h2>
          </div>
          <EmailInviteControls meetings={meetings} />
          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter email logs by recipient, status, and created date.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-12">
              <input name="sort" type="hidden" value={emailTableFilters.sort} />
              <input name="dir" type="hidden" value={emailTableFilters.dir} />
              <input
                name="perPage"
                type="hidden"
                value={emailTableFilters.perPage}
              />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-4">
                Recipient
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={emailTableFilters.recipient}
                  name="recipient"
                  placeholder="Search email"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Status
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={emailTableFilters.status}
                  name="status"
                >
                  <option value="all">All statuses</option>
                  <option value="queued">Queued</option>
                  <option value="sending">Sending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="permanent_failed">Permanent failed</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Created
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={emailTableFilters.created}
                  name="created"
                  type="date"
                />
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-2">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/communications"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Email Delivery Logs</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {emailPageStart}-{emailPageEnd} of {emailTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: emailTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={emailPageUrls}
                value={emailPage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {emailTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
                urlByValue={emailPerPageUrls}
                value={emailTableFilters.perPage}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    <a href={emailSortHref("recipient")}>
                      Recipient{emailSortLabel("recipient")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">Template</th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={emailSortHref("status")}>
                      Status{emailSortLabel("status")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={emailSortHref("created")}>
                      Created{emailSortLabel("created")}
                    </a>
                  </th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {pagedEmailLogs.map((log) => (
                  <tr className="border-b border-[var(--border)]" key={log.id}>
                    <td className="py-2 pr-3">{log.recipient_email}</td>
                    <td className="py-2 pr-3">{log.template_key}</td>
                    <td className="py-2 pr-3">{log.status}</td>
                    <td className="py-2 pr-3">{formatDateTime(log.created_at)}</td>
                    <td className="py-2">{log.error_message ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagedEmailLogs.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No email logs match the selected criteria.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a
              aria-disabled={emailPage <= 1}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                emailPage <= 1 ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
              href={emailHref({
                ...emailTableFilters,
                page: Math.max(1, emailPage - 1),
              })}
            >
              Previous
            </a>
            <div className="text-sm text-[var(--muted)]">
              {emailPageStart}-{emailPageEnd} / {emailTotal}
            </div>
            <a
              aria-disabled={emailPage >= emailTotalPages}
              className={[
                "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                emailPage >= emailTotalPages
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
              href={emailHref({
                ...emailTableFilters,
                page: Math.min(emailTotalPages, emailPage + 1),
              })}
            >
              Next
            </a>
          </div>
        </section>

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

        <section
          className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("ownership")}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Room Ownership</h2>
                <p className="text-sm text-[var(--muted)]">
                  Maintain current room-owner links and effective dates.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/ownership?mode=create&type=ownership_link"
            >
              Create ownership link
            </a>
          </div>
          <p className="mb-4 max-w-3xl text-sm text-[var(--muted)]">
            Maintain the active owner for each room. In v1, one room can have
            one active owner link. To transfer ownership, end the current active
            link first, then create a new link for the new owner.
          </p>
          <OwnershipManager
            drawer={drawer}
            owners={owners}
            roomOwners={roomOwners}
            rooms={rooms}
          />
        </section>

        <section
          className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("proxies")}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="text-[var(--primary)]" size={20} />
              <div>
                <h2 className="text-lg font-semibold">Proxy Authorizations</h2>
                <p className="text-sm text-[var(--muted)]">
                  Create and review proxy voting authority for a meeting and room.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/proxies?mode=create&type=proxy_authorization"
            >
              Add proxy authorization
            </a>
          </div>

          <section className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter proxy authorizations by meeting, room, and proxy.
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
                Meeting
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={proxyTableFilters.meeting}
                  name="meeting"
                  placeholder="Search meeting"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Room
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={proxyTableFilters.room}
                  name="room"
                  placeholder="Search room"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] md:col-span-3">
                Proxy
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={proxyTableFilters.proxy}
                  name="proxy"
                  placeholder="Search proxy"
                />
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 md:col-span-3">
                <button
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  type="submit"
                >
                  Search
                </button>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="/admin/proxies"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Results</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Showing {proxyPageStart}-{proxyPageEnd} of {proxyTotal}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <PerPageSelect
                label="Page"
                options={Array.from(
                  { length: proxyTotalPages },
                  (_, index) => index + 1,
                )}
                urlByValue={proxyPageUrls}
                value={proxyPage}
              />
              <div className="text-xs font-medium text-[var(--muted)]">
                of {proxyTotalPages}
              </div>
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
              <PerPageSelect
                label="Per page"
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
                      Meeting{proxySortLabel("meeting")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={proxySortHref("room")}>
                      Room{proxySortLabel("room")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={proxySortHref("owner")}>
                      Owner{proxySortLabel("owner")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={proxySortHref("proxy")}>
                      Proxy{proxySortLabel("proxy")}
                    </a>
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    <a href={proxySortHref("status")}>
                      Status{proxySortLabel("status")}
                    </a>
                  </th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedProxyAuthorizations.map((authorization) => {
                  const selected =
                    drawer?.mode === "edit" &&
                    drawer.type === "proxy_authorization" &&
                    drawer.id === authorization.id;

                  return (
                    <tr
                      className={[
                        "border-b border-[var(--border)]",
                        selected
                          ? "border-l-4 border-l-[var(--primary)] bg-[var(--accent)]"
                          : "",
                      ].join(" ")}
                      key={authorization.id}
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
                      <td className="py-2 pr-3">{authorization.status}</td>
                      <td className="py-2">
                        <a
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          href={`${proxyHref({
                            ...proxyTableFilters,
                            page: proxyPage,
                          })}&mode=edit&type=proxy_authorization&id=${authorization.id}`}
                        >
                          Review
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
              No proxy authorizations match the selected criteria.
            </p>
          ) : null}
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
              Previous
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
              Next
            </a>
          </div>
          {drawer?.mode === "create" && drawer.type === "proxy_authorization" ? (
            <AdminCrudDrawer
              closeHref="/admin/proxies"
              summary={["New proxy authorization"]}
              title="Add proxy authorization"
            >
              <form action={createProxyAuthorization} className="grid gap-3">
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Meeting</FieldLabel>
                  <select
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="meeting_id"
                    required
                  >
                    <option value="">Select meeting</option>
                    {meetings
                      .filter((meeting) => meeting.status !== "archived")
                      .map((meeting) => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Room</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="room_id"
                    required
                  >
                    <option value="">Select room</option>
                    {rooms
                      .filter((room) => room.active)
                      .map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_number}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Owner
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="owner_id"
                  >
                    <option value="">Owner optional</option>
                    {owners
                      .filter((owner) => owner.active)
                      .map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.full_name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Proxy profile</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="proxy_profile_id"
                    required
                  >
                    <option value="">Select proxy profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name} ({profile.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Valid from
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="valid_from"
                    type="date"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Valid until
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="valid_until"
                    type="date"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Add proxy authorization
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/proxies"
                  >
                    Cancel
                  </a>
                </div>
              </form>
            </AdminCrudDrawer>
          ) : null}
          {drawer?.mode === "edit" && drawer.type === "proxy_authorization"
            ? proxyAuthorizations
                .filter((authorization) => authorization.id === drawer.id)
                .map((authorization) => (
                  <AdminCrudDrawer
                    closeHref="/admin/proxies"
                    key={authorization.id}
                    summary={[
                      `Meeting: ${authorization.meetings?.title ?? "-"}`,
                      `Room: ${authorization.rooms?.room_number ?? "-"}`,
                      `Proxy: ${authorization.profiles?.full_name ?? "-"}`,
                    ]}
                    title="Review proxy authorization"
                  >
                    <form action={reviewProxyAuthorization} className="grid gap-3">
                      <input name="id" type="hidden" value={authorization.id} />
                      <label className="grid gap-1 text-sm font-medium">
                        <FieldLabel required>Status</FieldLabel>
                        <select
                          autoFocus
                          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                          defaultValue={authorization.status}
                          name="status"
                          required
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="revoked">Revoked</option>
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <ConfirmSubmitButton
                          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                          confirmMessage={`Update proxy authorization for room ${authorization.rooms?.room_number ?? "-"}? Approving, rejecting, or revoking changes who can vote for this room.`}
                          pendingLabel="Saving..."
                          type="submit"
                        >
                          Save review
                        </ConfirmSubmitButton>
                        <FormResetButton label="Reset changes" />
                        <a
                          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                          href="/admin/proxies"
                        >
                          Cancel
                        </a>
                      </div>
                    </form>
                  </AdminCrudDrawer>
                ))
            : null}
        </section>

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
