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
  importManualVoteEntry,
  publishMeeting,
  reviewProxyAuthorization,
  resolveVoteSourceConflict,
  registerDocumentReference,
  saveAppSettings,
  saveCondoProfile,
} from "@/features/admin/actions";
import { EmailInviteControls } from "@/features/admin/components/email-invite-controls";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import {
  ConfirmSubmitButton,
  FormResetButton,
} from "@/features/admin/components/form-controls";
import { OwnershipManager } from "@/features/admin/components/ownership-manager";
import { PeopleCrudPilot } from "@/features/admin/components/people-crud-pilot";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { getAdminDashboardData } from "@/features/admin/data";
import type { AuditLogFilters } from "@/features/admin/data-modules/documents";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAuditDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
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
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  sections?: AdminSection[];
  title?: string;
  description?: string;
};

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
  drawer,
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
    documents,
    rooms,
    appRoles,
    owners,
    roomOwners,
    meetings,
    questions,
    manualBallots,
    voteSourceResolutions,
    ballots,
    proxyAuthorizations,
    resultSnapshots,
    committeeApprovals,
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
  const appRolesByProfile = new Map(
    profiles.map((profile) => [
      profile.id,
      appRoles.filter((role) => role.profile_id === profile.id),
    ]),
  );
  const submittedOnlineRoomKeys = new Set(
    ballots.map((ballot) => `${ballot.meeting_id}:${ballot.room_id}`),
  );
  const onlineBallotByRoomKey = new Map(
    ballots.map((ballot) => [
      `${ballot.meeting_id}:${ballot.room_id}`,
      ballot,
    ]),
  );
  const manualBallotByRoomKey = new Map(
    manualBallots.map((manualBallot) => [
      `${manualBallot.meeting_id}:${manualBallot.room_id}`,
      manualBallot,
    ]),
  );
  const manualRoomKeys = new Set(manualBallotByRoomKey.keys());
  const resolutionByRoomKey = new Map(
    voteSourceResolutions.map((resolution) => [
      `${resolution.meeting_id}:${resolution.room_id}`,
      resolution,
    ]),
  );
  const voteSourceConflicts = [...manualRoomKeys]
    .filter((key) => submittedOnlineRoomKeys.has(key))
    .map((key) => {
      const [meetingId, roomId] = key.split(":");
      const meeting = meetings.find((item) => item.id === meetingId);
      const room = rooms.find((item) => item.id === roomId);
      const onlineBallot = onlineBallotByRoomKey.get(key);
      const manualBallot = manualBallotByRoomKey.get(key);
      const resolution = resolutionByRoomKey.get(key);
      const matchingResolution =
        resolution &&
        onlineBallot &&
        manualBallot &&
        resolution.online_ballot_id === onlineBallot.id &&
        resolution.manual_ballot_id === manualBallot.id
          ? resolution
          : null;

      return {
        key,
        meetingId,
        roomId,
        onlineBallotId: onlineBallot?.id ?? "",
        manualBallotId: manualBallot?.id ?? "",
        meetingTitle: meeting?.title ?? "-",
        roomNumber: room?.room_number ?? "-",
        resolution: matchingResolution,
      };
    });
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
  const makeAuditHref = (
    overrides: {
      actions?: string[] | null;
      actor?: string | null;
      dir?: string | null;
      from?: string | null;
      page?: number | null;
      perPage?: number | null;
      sort?: string | null;
      to?: string | null;
    } = {},
  ) => {
    const params = new URLSearchParams();

    params.set("tab", "audit");

    const from = overrides.from === undefined ? auditFilters?.dateFrom : overrides.from;
    const to = overrides.to === undefined ? auditFilters?.dateTo : overrides.to;
    const actor =
      overrides.actor === undefined ? auditFilters?.actorProfileId : overrides.actor;
    const actions =
      overrides.actions === undefined ? auditFilters?.actions : overrides.actions;
    const sort = overrides.sort === undefined ? auditSortBy : overrides.sort;
    const dir =
      overrides.dir === undefined ? auditSortDirection : overrides.dir;
    const page = overrides.page === undefined ? auditLogPage : overrides.page;
    const perPage =
      overrides.perPage === undefined ? auditLogPerPage : overrides.perPage;

    if (from) {
      params.set("from", from);
    }

    if (to) {
      params.set("to", to);
    }

    if (actor) {
      params.set("actor", actor);
    }

    actions?.forEach((action) => params.append("actions", action));

    if (sort) {
      params.set("sort", sort);
    }

    if (dir) {
      params.set("dir", dir);
    }

    if (page && page > 1) {
      params.set("page", String(page));
    }

    if (perPage && perPage !== 25) {
      params.set("perPage", String(perPage));
    }

    return `?${params.toString()}`;
  };
  const makeAuditSortHref = (sortBy: NonNullable<AuditLogFilters["sortBy"]>) =>
    makeAuditHref({
      dir:
        auditSortBy === sortBy && auditSortDirection === "asc" ? "desc" : "asc",
      page: 1,
      sort: sortBy,
    });
  const auditSortLabel = (sortBy: NonNullable<AuditLogFilters["sortBy"]>) => {
    if (auditSortBy !== sortBy) {
      return "";
    }

    return auditSortDirection === "asc" ? " ↑" : " ↓";
  };
  const auditTotalPages = Math.max(
    1,
    Math.ceil(auditLogTotal / auditLogPerPage),
  );
  const auditPageStart =
    auditLogTotal === 0 ? 0 : (auditLogPage - 1) * auditLogPerPage + 1;
  const auditPageEnd = Math.min(auditLogPage * auditLogPerPage, auditLogTotal);

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
                <h2 className="text-lg font-semibold">
                  Private Document Registry
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Keep private document locations and verification metadata.
                </p>
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/setup?tab=storage&mode=create&type=document_reference"
            >
              Register document
            </a>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Store a local-drive path or private Google Drive link. Keep file
            credentials outside the database. SHA-256 and file size verify the
            exact file; document set key groups versions of the same document.
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

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Set / version</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Path or link</th>
                  <th className="py-2 font-medium">SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    className="border-b border-[var(--border)]"
                    key={document.id}
                  >
                    <td className="py-2 pr-3">
                      {document.document_set_key} / v{document.document_version}
                    </td>
                    <td className="py-2 pr-3">{document.document_type}</td>
                    <td className="py-2 pr-3">{document.storage_provider}</td>
                    <td className="max-w-xs truncate py-2 pr-3">
                      {document.storage_path}
                    </td>
                    <td className="max-w-xs truncate py-2">
                      {document.checksum_sha256 ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No private document references have been registered yet.
            </p>
          ) : null}
          {drawer?.mode === "create" && drawer.type === "document_reference" ? (
            <AdminCrudDrawer
              closeHref="/admin/setup?tab=storage"
              summary={["New private document reference"]}
              title="Register document"
            >
              <form action={registerDocumentReference} className="grid gap-3">
                <RequiredNote />
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Storage provider</FieldLabel>
                  <select
                    autoFocus
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue="local_drive"
                    name="storage_provider"
                    required
                  >
                    <option value="local_drive">Local drive</option>
                    <option value="google_drive">Google Drive</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Owner type</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="owner_type"
                    required
                  >
                    <option value="profile">Profile</option>
                    <option value="approval_request">Approval request</option>
                    <option value="proxy_authorization">Proxy authorization</option>
                    <option value="meeting">Meeting</option>
                    <option value="result_snapshot">Result snapshot</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Document type</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="document_type"
                    required
                  >
                    <option value="owner_verification">Owner verification</option>
                    <option value="proxy_authorization">Proxy authorization</option>
                    <option value="meeting_attachment">Meeting attachment</option>
                    <option value="result_pdf">Result PDF</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Owner UUID</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="owner_id"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>
                    Relative path or private Drive file link
                  </FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="storage_path"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Document set key</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="document_set_key"
                    placeholder="proxy-meeting-room"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Version</FieldLabel>
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue={1}
                    min={1}
                    name="document_version"
                    type="number"
                    required
                  />
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="original_filename"
                  placeholder="Original filename"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="mime_type"
                  placeholder="MIME type"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  min={0}
                  name="file_size_bytes"
                  placeholder="File size bytes"
                  type="number"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="checksum_sha256"
                  placeholder="SHA-256 checksum, 64 hex characters"
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Register document
                  </PendingSubmitButton>
                  <FormResetButton label="Clear form" />
                  <a
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    href="/admin/setup?tab=storage"
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
          hidden={!visibleSections.has("audit")}
          id="audit"
        >
          <div className="mb-4 flex items-center gap-2">
            <History className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Business Audit Log</h2>
          </div>
          <section className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Search Criteria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filter audit events by time range, actor, and action. Results are
                queried server-side.
              </p>
            </div>
            <form className="grid gap-3 lg:grid-cols-12">
              <input name="tab" type="hidden" value="audit" />
              <input name="sort" type="hidden" value={auditSortBy} />
              <input name="dir" type="hidden" value={auditSortDirection} />
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
                From
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={auditFilters?.dateFrom ?? ""}
                  name="from"
                  step={600}
                  type="datetime-local"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
                To
                <input
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={auditFilters?.dateTo ?? ""}
                  name="to"
                  step={600}
                  type="datetime-local"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
                Actor
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={auditFilters?.actorProfileId ?? ""}
                  name="actor"
                >
                  <option value="">All actors</option>
                  {auditActors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-3">
                Per page
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={String(auditLogPerPage)}
                  name="perPage"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted)] lg:col-span-8">
                Actions
                <select
                  className="min-h-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  defaultValue={auditFilters?.actions ?? []}
                  multiple
                  name="actions"
                >
                  {auditActions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-end justify-center gap-2 lg:col-span-4">
                <PendingSubmitButton
                  className="min-h-10 rounded-md bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  pendingLabel="Searching..."
                  type="submit"
                >
                  Search
                </PendingSubmitButton>
                <a
                  className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-medium"
                  href="?tab=audit"
                >
                  Clear
                </a>
              </div>
            </form>
          </section>

          <section className="mt-5 rounded-md border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Results</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Showing {auditPageStart}-{auditPageEnd} of {auditLogTotal}
                </p>
              </div>
              <div className="text-xs text-[var(--muted)]">
                Page {auditLogPage} of {auditTotalPages}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="bg-[var(--background)] text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="w-32 min-w-32 px-4 py-3 font-medium">
                      <a href={makeAuditSortHref("time")}>
                        Time{auditSortLabel("time")}
                      </a>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <a href={makeAuditSortHref("actor")}>
                        Actor{auditSortLabel("actor")}
                      </a>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <a href={makeAuditSortHref("action")}>
                        Action{auditSortLabel("action")}
                      </a>
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <a href={makeAuditSortHref("entity")}>
                        Entity{auditSortLabel("entity")}
                      </a>
                    </th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, index) => {
                    const timestamp = formatAuditDateTime(log.created_at);

                    return (
                      <tr
                        className={[
                          "border-b border-[var(--border)] last:border-0",
                          index % 2 === 0
                            ? "bg-[var(--surface)]"
                            : "bg-[var(--background)]",
                        ].join(" ")}
                        key={log.id}
                      >
                        <td className="w-32 min-w-32 px-4 py-3 text-xs tabular-nums">
                          <div>{timestamp.date}</div>
                          <div className="text-[var(--muted)]">
                            {timestamp.time}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {log.profiles?.full_name ?? log.profiles?.email ?? "-"}
                        </td>
                        <td className="px-4 py-3">{log.action}</td>
                        <td className="px-4 py-3">{log.entity_type}</td>
                        <td className="max-w-sm truncate px-4 py-3">
                          {JSON.stringify(log.details_json)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {auditLogs.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--muted)]">
                No audit log rows match the selected criteria.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <a
                aria-disabled={auditLogPage <= 1}
                className={[
                  "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                  auditLogPage <= 1 ? "pointer-events-none opacity-50" : "",
                ].join(" ")}
                href={makeAuditHref({ page: Math.max(1, auditLogPage - 1) })}
              >
                Previous
              </a>
              <div className="text-sm text-[var(--muted)]">
                {auditPageStart}-{auditPageEnd} / {auditLogTotal}
              </div>
              <a
                aria-disabled={auditLogPage >= auditTotalPages}
                className={[
                  "inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium",
                  auditLogPage >= auditTotalPages
                    ? "pointer-events-none opacity-50"
                    : "",
                ].join(" ")}
                href={makeAuditHref({
                  page: Math.min(auditTotalPages, auditLogPage + 1),
                })}
              >
                Next
              </a>
            </div>
          </section>
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
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/voting?mode=create&type=manual_vote"
            >
              Import manual vote
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Meeting</th>
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="py-2 pr-3 font-medium">Question</th>
                  <th className="py-2 pr-3 font-medium">Choice</th>
                  <th className="py-2 font-medium">Audit</th>
                </tr>
              </thead>
              <tbody>
                {manualBallots.flatMap((manualBallot) =>
                  manualBallot.manual_ballot_answers.map((answer) => (
                    <tr className="border-b border-[var(--border)]" key={answer.id}>
                      <td className="py-2 pr-3">
                        {manualBallot.meetings?.title ?? "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {manualBallot.rooms?.room_number ?? "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {answer.meeting_questions?.question_text ?? "-"}
                      </td>
                      <td className="py-2 pr-3">
                        {answer.meeting_choices?.choice_text ?? "-"}
                      </td>
                      <td className="py-2">
                        {manualBallot.source_label ?? "manual"} /{" "}
                        {manualBallot.audit_note ?? "-"}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          {manualBallots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No manual ballots have been imported yet.
            </p>
          ) : null}
          {drawer?.mode === "create" && drawer.type === "manual_vote" ? (
            <AdminCrudDrawer
              closeHref="/admin/voting"
              summary={["New manual ballot answer"]}
              title="Import manual vote"
            >
              <form action={importManualVoteEntry} className="grid gap-3">
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
                  <FieldLabel required>Question</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="question_id"
                    required
                  >
                    <option value="">Select question</option>
                    {questions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.meetings?.title ?? "-"} /{" "}
                        {question.agenda_no ?? "-"} {question.question_text}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <FieldLabel required>Choice</FieldLabel>
                  <select
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="choice_id"
                    required
                  >
                    <option value="">Select choice</option>
                    {questions.flatMap((question) =>
                      question.meeting_choices
                        .sort(
                          (left, right) =>
                            left.display_order - right.display_order,
                        )
                        .map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {question.question_text} / {choice.choice_text}
                          </option>
                        )),
                    )}
                  </select>
                </label>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="source_label"
                  placeholder="Source label"
                />
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="audit_note"
                  placeholder="Audit note"
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingSubmitButton
                    className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                    pendingLabel="Adding..."
                    type="submit"
                  >
                    Import manual vote
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

          {voteSourceConflicts.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Conflict</th>
                    <th className="py-2 pr-3 font-medium">Resolution</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {voteSourceConflicts.map((conflict) => (
                    <tr className="border-b border-[var(--border)]" key={conflict.key}>
                      <td className="py-2 pr-3">
                        {conflict.meetingTitle} / room {conflict.roomNumber}
                      </td>
                      <td className="py-2 pr-3">
                        {conflict.resolution?.chosen_source ?? "unresolved"}
                      </td>
                      <td className="py-2">
                        <form
                          action={resolveVoteSourceConflict}
                          className="flex flex-wrap gap-2"
                        >
                          <input
                            name="meeting_id"
                            type="hidden"
                            value={conflict.meetingId}
                          />
                          <input
                            name="room_id"
                            type="hidden"
                            value={conflict.roomId}
                          />
                          <input
                            name="online_ballot_id"
                            type="hidden"
                            value={conflict.onlineBallotId}
                          />
                          <input
                            name="manual_ballot_id"
                            type="hidden"
                            value={conflict.manualBallotId}
                          />
                          <select
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                            defaultValue={
                              conflict.resolution?.chosen_source ?? "manual"
                            }
                            name="chosen_source"
                          >
                            <option value="manual">Manual</option>
                            <option value="online">Online</option>
                          </select>
                          <input
                            className="w-56 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                            defaultValue={
                              conflict.resolution?.conflict_remark ?? ""
                            }
                            name="conflict_remark"
                            placeholder="Conflict remark"
                          />
                          <PendingSubmitButton
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                            pendingLabel="Saving..."
                            type="submit"
                          >
                            Resolve source
                          </PendingSubmitButton>
                          <FormResetButton label="Reset changes" />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Position</th>
                  <th className="py-2 pr-3 font-medium">Term</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {committeeMembers.map((member) => (
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
          {committeeMembers.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No committee members have been added yet.
            </p>
          ) : null}
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

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">No./Type</th>
                  <th className="py-2 pr-3 font-medium">Window</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => {
                  const hasApprovedResult = approvedMeetingIds.has(meeting.id);

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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Meeting</th>
                  <th className="py-2 pr-3 font-medium">Generated</th>
                  <th className="py-2 pr-3 font-medium">Submitted</th>
                  <th className="py-2 pr-3 font-medium">Ownership</th>
                  <th className="py-2 pr-3 font-medium">Approval</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {resultSnapshots.map((snapshot) => {
                  const totals = getResultTotals(snapshot.payload_json);
                  const approved = approvedResultSnapshotIds.has(snapshot.id);
                  const meetingApproved = approvedMeetingIds.has(
                    snapshot.meeting_id,
                  );
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
                        {!meetingApproved ? (
                          <a
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                            href={`/admin/results?mode=edit&type=result_approval&id=${snapshot.id}`}
                          >
                            Approve result
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
          {resultSnapshots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No result snapshots have been generated yet.
            </p>
          ) : null}
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
                        <ConfirmSubmitButton
                          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                          confirmMessage={`Approve result for "${snapshot.meetings?.title ?? "this meeting"}"? This locks the approved result snapshot as the source of truth.`}
                          pendingLabel="Saving..."
                          type="submit"
                        >
                          Approve result
                        </ConfirmSubmitButton>
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Recipient</th>
                  <th className="py-2 pr-3 font-medium">Template</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log) => (
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
          {emailLogs.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No email events have been queued yet.
            </p>
          ) : null}
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

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Meeting</th>
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Proxy</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {proxyAuthorizations.map((authorization) => {
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
                          href={`/admin/proxies?mode=edit&type=proxy_authorization&id=${authorization.id}`}
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
          {proxyAuthorizations.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No proxy authorizations have been created yet.
            </p>
          ) : null}
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
