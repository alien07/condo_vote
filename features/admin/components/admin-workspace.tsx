import {
  Building2,
  CalendarDays,
  FileText,
  ListChecks,
  ShieldCheck,
  UserCheck,
  UserRound,
} from "lucide-react";
import {
  approveResultSnapshot,
  archiveMeeting,
  createCommitteeMember,
  createMeetingChoice,
  createMeeting,
  createMeetingQuestion,
  createOwner,
  createProxyAuthorization,
  createRoom,
  deactivateOwner,
  deactivateRoom,
  deactivateCommitteeMember,
  deleteMeetingChoice,
  deleteMeetingQuestion,
  endRoomOwnerLink,
  generateResultSnapshot,
  grantAppRole,
  importManualVoteEntry,
  linkRoomOwner,
  publishMeeting,
  reviewProxyAuthorization,
  resolveVoteSourceConflict,
  revokeAppRole,
  saveCondoProfile,
  updateProfileApproval,
} from "@/features/admin/actions";
import { getAdminDashboardData } from "@/features/admin/data";

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

export type AdminSection =
  | "setup"
  | "voting"
  | "committee"
  | "meetings"
  | "questions"
  | "results"
  | "email"
  | "people"
  | "ownership"
  | "proxies"
  | "profiles";

type AdminWorkspaceProps = {
  sections?: AdminSection[];
  title?: string;
  description?: string;
};

const allSections: AdminSection[] = [
  "setup",
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
  sections = allSections,
  title = "Admin",
  description = "Room, owner, profile, and role-controlled demo workspace.",
}: AdminWorkspaceProps) {
  const {
    condoProfile,
    committeeMembers,
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
    eligibleVoters,
    resultSnapshots,
    committeeApprovals,
    emailLogs,
    profiles,
  } =
    await getAdminDashboardData();
  const activeRooms = rooms.filter((room) => room.active).length;
  const activeOwners = owners.filter((owner) => owner.active).length;
  const activeRoomOwnerLinks = roomOwners.filter((link) => !link.ends_at).length;
  const activeMeetings = meetings.filter(
    (meeting) => meeting.status !== "archived",
  ).length;
  const pendingProxyAuthorizations = proxyAuthorizations.filter(
    (authorization) => authorization.status === "pending",
  ).length;
  const questionCount = questions.length;
  const eligibleVoterCount = eligibleVoters.length;
  const approvedResultSnapshotIds = new Set(
    committeeApprovals.map((approval) => approval.result_snapshot_id),
  );
  const approvalBySnapshotId = new Map(
    committeeApprovals.map((approval) => [approval.result_snapshot_id, approval]),
  );
  const approvedMeetingIds = new Set(
    committeeApprovals.map((approval) => approval.meeting_id),
  );
  const queuedEmailCount = emailLogs.filter((log) => log.status === "queued").length;
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
  const visibleSections = new Set(sections);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[var(--primary)]" size={26} />
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-[var(--muted)]">{description}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-6">
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeRooms}</div>
              <div className="text-[var(--muted)]">Active rooms</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeOwners}</div>
              <div className="text-[var(--muted)]">Active owners</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeRoomOwnerLinks}</div>
              <div className="text-[var(--muted)]">Room links</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{activeMeetings}</div>
              <div className="text-[var(--muted)]">Meetings</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{questionCount}</div>
              <div className="text-[var(--muted)]">Questions</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{eligibleVoterCount}</div>
              <div className="text-[var(--muted)]">Eligible</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{manualBallots.length}</div>
              <div className="text-[var(--muted)]">Manual votes</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{voteSourceConflicts.length}</div>
              <div className="text-[var(--muted)]">Conflicts</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{pendingProxyAuthorizations}</div>
              <div className="text-[var(--muted)]">Proxy requests</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{resultSnapshots.length}</div>
              <div className="text-[var(--muted)]">Results</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{committeeApprovals.length}</div>
              <div className="text-[var(--muted)]">Approvals</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{queuedEmailCount}</div>
              <div className="text-[var(--muted)]">Queued mail</div>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-semibold">{profiles.length}</div>
              <div className="text-[var(--muted)]">Profiles</div>
            </div>
          </div>
        </div>

        {sections.length > 1 ? (
          <nav className="sticky top-0 z-10 mb-5 flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)] py-3 text-sm">
            {[
              ["setup", "#setup", "Setup"],
              ["voting", "#voting", "Voting"],
              ["meetings", "#meetings", "Meetings"],
              ["results", "#results", "Results"],
              ["email", "#email", "Email"],
              ["people", "#people", "People"],
            ]
              .filter(([section]) => visibleSections.has(section as AdminSection))
              .map(([, href, label]) => (
                <a
                  className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium"
                  href={href}
                  key={href}
                >
                  {label}
                </a>
              ))}
          </nav>
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
            <input name="id" type="hidden" value={condoProfile?.id ?? ""} />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.juristic_name ?? ""}
              name="juristic_name"
              placeholder="Juristic person name"
              required
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={condoProfile?.project_name ?? ""}
              name="project_name"
              placeholder="Project name"
              required
            />
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
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
              type="submit"
            >
              Save juristic profile
            </button>
          </form>
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("voting")}
          id="voting"
        >
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Manual Votes</h2>
          </div>
          <form
            action={importManualVoteEntry}
            className="grid gap-3 md:grid-cols-4"
          >
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Meeting</option>
              {meetings
                .filter((meeting) => meeting.status !== "archived")
                .map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="room_id"
              required
            >
              <option value="">Room</option>
              {rooms
                .filter((room) => room.active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="question_id"
              required
            >
              <option value="">Question</option>
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.meetings?.title ?? "-"} / {question.agenda_no ?? "-"}{" "}
                  {question.question_text}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="choice_id"
              required
            >
              <option value="">Choice</option>
              {questions.flatMap((question) =>
                question.meeting_choices
                  .sort((left, right) => left.display_order - right.display_order)
                  .map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {question.question_text} / {choice.choice_text}
                    </option>
                  )),
              )}
            </select>
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="source_label"
              placeholder="Source label"
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              name="audit_note"
              placeholder="Audit note"
            />
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              Import manual vote
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
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
                          <button
                            className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                            type="submit"
                          >
                            Resolve source
                          </button>
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
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Committee Members</h2>
          </div>
          <form
            action={createCommitteeMember}
            className="grid gap-3 md:grid-cols-4"
          >
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
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="full_name"
              placeholder="Committee name"
              required
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="position_title"
              placeholder="Position"
              required
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={0}
              min={0}
              name="display_order"
              placeholder="Order"
              type="number"
            />
            <label className="text-sm font-medium">
              Term starts
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="term_starts_at"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Term ends
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="term_ends_at"
                type="date"
              />
            </label>
            <button
              className="self-end rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
              type="submit"
            >
              Add committee member
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
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
                          <button
                            className="text-sm font-medium text-red-700"
                            type="submit"
                          >
                            Deactivate
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("meetings")}
          id="meetings"
        >
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Meetings</h2>
          </div>
          <form action={createMeeting} className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="title"
              placeholder="Meeting title"
              required
            />
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
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue="online_vote"
              name="meeting_type"
            >
              <option value="online_vote">Online vote</option>
              <option value="agm">AGM</option>
              <option value="egm">EGM</option>
              <option value="committee">Committee</option>
            </select>
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
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue="one_fourth_total_ownership"
              name="quorum_rule"
            >
              <option value="one_fourth_total_ownership">
                Quorum: 1/4 ownership
              </option>
              <option value="not_required_second_call">
                Second call: no quorum
              </option>
              <option value="committee_policy">Committee policy</option>
            </select>
            <label className="text-sm font-medium">
              Starts
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="starts_at"
                required
                type="datetime-local"
              />
            </label>
            <label className="text-sm font-medium">
              Ends
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ends_at"
                required
                type="datetime-local"
              />
            </label>
            <textarea
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              name="description"
              placeholder="Description"
              rows={3}
            />
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
              type="submit"
            >
              Add meeting
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
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
                              <button
                                className="text-sm font-medium text-[var(--primary)]"
                                type="submit"
                              >
                                Publish
                              </button>
                            </form>
                          ) : null}
                          {meeting.status !== "archived" ? (
                            <form action={archiveMeeting}>
                              <input name="id" type="hidden" value={meeting.id} />
                              <button
                                className="text-sm font-medium text-red-700"
                                type="submit"
                              >
                                Archive
                              </button>
                            </form>
                          ) : null}
                          {(meeting.status === "published" ||
                            meeting.status === "closed") &&
                          !hasApprovedResult ? (
                            <form action={generateResultSnapshot}>
                              <input name="id" type="hidden" value={meeting.id} />
                              <button
                                className="text-sm font-medium text-[var(--primary)]"
                                type="submit"
                              >
                                Generate result
                              </button>
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
        </section>

        <section
          className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("questions")}
        >
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Questions And Choices</h2>
          </div>
          <form
            action={createMeetingQuestion}
            className="grid gap-3 md:grid-cols-4"
          >
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Meeting</option>
              {meetings
                .filter((meeting) => meeting.status !== "archived")
                .map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
            </select>
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="agenda_no"
              placeholder="Agenda no."
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              name="agenda_title"
              placeholder="Agenda title"
            />
            <input
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              name="question_text"
              placeholder="Question"
              required
            />
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="question_type"
              required
            >
              <option value="single_choice">Single choice</option>
              <option value="multiple_choice">Multiple choice</option>
            </select>
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
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm md:col-span-4"
              name="legal_note"
              placeholder="Legal / admin note"
              rows={2}
            />
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
              type="submit"
            >
              Add question
            </button>
          </form>

          <div className="mt-5 grid gap-4">
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
                    <button
                      className="text-sm font-medium text-red-700"
                      type="submit"
                    >
                      Delete question
                    </button>
                  </form>
                </div>
                <form
                  action={createMeetingChoice}
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_160px]"
                >
                  <input name="question_id" type="hidden" value={question.id} />
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    name="choice_text"
                    placeholder="Choice"
                    required
                  />
                  <input
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                    defaultValue={0}
                    min={0}
                    name="display_order"
                    placeholder="Order"
                    type="number"
                  />
                  <button
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                    type="submit"
                  >
                    Add choice
                  </button>
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
                        <button className="font-medium text-red-700" type="submit">
                          Delete
                        </button>
                      </form>
                    ))}
                </div>
              </div>
            ))}
          </div>
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

                  return (
                    <tr
                      className="border-b border-[var(--border)]"
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
                          <form
                            action={approveResultSnapshot}
                            className="flex flex-wrap gap-2"
                          >
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
                            <input
                              className="w-48 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                              name="notes"
                              placeholder="Approval / conflict notes"
                            />
                            <button
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                              type="submit"
                            >
                              Approve result
                            </button>
                          </form>
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

        <div
          className="grid scroll-mt-20 gap-5 lg:grid-cols-2"
          hidden={!visibleSections.has("people")}
          id="people"
        >
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="text-[var(--primary)]" size={20} />
              <h2 className="text-lg font-semibold">Rooms</h2>
            </div>
            <form action={createRoom} className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="room_number"
                placeholder="Room number"
                required
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ownership_percent"
                placeholder="Ownership %"
                required
                step="0.000001"
                type="number"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="building"
                placeholder="Building"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="floor"
                placeholder="Floor"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="area_size"
                placeholder="Area size"
                step="0.01"
                type="number"
              />
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                type="submit"
              >
                Add room
              </button>
            </form>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Room</th>
                    <th className="py-2 pr-3 font-medium">Owner %</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr className="border-b border-[var(--border)]" key={room.id}>
                      <td className="py-2 pr-3">{room.room_number}</td>
                      <td className="py-2 pr-3">{room.ownership_percent}</td>
                      <td className="py-2 pr-3">
                        {room.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        {room.active ? (
                          <form action={deactivateRoom}>
                            <input name="id" type="hidden" value={room.id} />
                            <button
                              className="text-sm font-medium text-red-700"
                              type="submit"
                            >
                              Deactivate
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="text-[var(--primary)]" size={20} />
              <h2 className="text-lg font-semibold">Owners</h2>
            </div>
            <form action={createOwner} className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="full_name"
                placeholder="Full name"
                required
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="email"
                placeholder="Email"
                type="email"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="phone"
                placeholder="Phone"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="line_id"
                placeholder="LINE ID"
              />
              <button
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-2"
                type="submit"
              >
                Add owner
              </button>
            </form>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => (
                    <tr className="border-b border-[var(--border)]" key={owner.id}>
                      <td className="py-2 pr-3">{owner.full_name}</td>
                      <td className="py-2 pr-3">{owner.email ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {owner.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        {owner.active ? (
                          <form action={deactivateOwner}>
                            <input name="id" type="hidden" value={owner.id} />
                            <button
                              className="text-sm font-medium text-red-700"
                              type="submit"
                            >
                              Deactivate
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section
          className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("ownership")}
        >
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Room Ownership</h2>
          </div>
          <form action={linkRoomOwner} className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="room_id"
              required
            >
              <option value="">Room</option>
              {rooms
                .filter((room) => room.active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="owner_id"
              required
            >
              <option value="">Owner</option>
              {owners
                .filter((owner) => owner.active)
                .map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="ownership_role"
              required
            >
              <option value="owner">Owner</option>
              <option value="co_owner">Co-owner</option>
            </select>
            <label className="text-sm font-medium">
              Starts
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="starts_at"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Ends
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="ends_at"
                type="date"
              />
            </label>
            <button
              className="self-end rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              type="submit"
            >
              Link owner to room
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Dates</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {roomOwners.map((link) => (
                  <tr className="border-b border-[var(--border)]" key={link.id}>
                    <td className="py-2 pr-3">{link.rooms?.room_number ?? "-"}</td>
                    <td className="py-2 pr-3">{link.owners?.full_name ?? "-"}</td>
                    <td className="py-2 pr-3">{link.ownership_role}</td>
                    <td className="py-2 pr-3">
                      {link.starts_at ?? "Not set"} - {link.ends_at ?? "Current"}
                    </td>
                    <td className="py-2">
                      {!link.ends_at ? (
                        <form action={endRoomOwnerLink} className="flex gap-2">
                          <input name="id" type="hidden" value={link.id} />
                          <input
                            className="w-36 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                            name="ends_at"
                            type="date"
                          />
                          <button
                            className="text-sm font-medium text-red-700"
                            type="submit"
                          >
                            End
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("proxies")}
        >
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="text-[var(--primary)]" size={20} />
            <h2 className="text-lg font-semibold">Proxy Authorizations</h2>
          </div>
          <form
            action={createProxyAuthorization}
            className="grid gap-3 md:grid-cols-3"
          >
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="meeting_id"
              required
            >
              <option value="">Meeting</option>
              {meetings
                .filter((meeting) => meeting.status !== "archived")
                .map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </option>
                ))}
            </select>
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="room_id"
              required
            >
              <option value="">Room</option>
              {rooms
                .filter((room) => room.active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
            </select>
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
            <select
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              name="proxy_profile_id"
              required
            >
              <option value="">Proxy profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name} ({profile.email})
                </option>
              ))}
            </select>
            <label className="text-sm font-medium">
              Valid from
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="valid_from"
                type="date"
              />
            </label>
            <label className="text-sm font-medium">
              Valid until
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="valid_until"
                type="date"
              />
            </label>
            <button
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] md:col-span-3"
              type="submit"
            >
              Add proxy authorization
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
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
                {proxyAuthorizations.map((authorization) => (
                  <tr
                    className="border-b border-[var(--border)]"
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
                      <form
                        action={reviewProxyAuthorization}
                        className="flex flex-wrap gap-2"
                      >
                        <input name="id" type="hidden" value={authorization.id} />
                        <select
                          className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                          defaultValue={authorization.status}
                          name="status"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="revoked">Revoked</option>
                        </select>
                        <button
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                          type="submit"
                        >
                          Review
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
          hidden={!visibleSections.has("profiles")}
        >
          <h2 className="text-lg font-semibold">Registered Profiles</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Default status</th>
                  <th className="py-2 pr-3 font-medium">Approval</th>
                  <th className="py-2 pr-3 font-medium">Roles</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const profileRoles = appRolesByProfile.get(profile.id) ?? [];

                  return (
                    <tr className="border-b border-[var(--border)]" key={profile.id}>
                      <td className="py-2 pr-3">{profile.full_name}</td>
                      <td className="py-2 pr-3">{profile.email}</td>
                      <td className="py-2 pr-3">{profile.default_status}</td>
                      <td className="py-2 pr-3">{profile.approval_status}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {profileRoles.map((role) => (
                            <form
                              action={revokeAppRole}
                              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1"
                              key={role.id}
                            >
                              <span>{role.role}</span>
                              <input name="id" type="hidden" value={role.id} />
                              <button
                                className="text-xs font-medium text-red-700"
                                type="submit"
                              >
                                Revoke
                              </button>
                            </form>
                          ))}
                          {profileRoles.length === 0 ? "-" : null}
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-2">
                          <form
                            action={updateProfileApproval}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input name="id" type="hidden" value={profile.id} />
                            <select
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                              defaultValue={profile.default_status}
                              name="default_status"
                            >
                              <option value="owner">Owner</option>
                              <option value="resident">Resident</option>
                              <option value="proxy">Proxy</option>
                            </select>
                            <select
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                              defaultValue={profile.approval_status}
                              name="approval_status"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                            <button
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                              type="submit"
                            >
                              Save
                            </button>
                          </form>
                          <form
                            action={grantAppRole}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              name="profile_id"
                              type="hidden"
                              value={profile.id}
                            />
                            <select
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                              name="role"
                            >
                              <option value="admin">Admin</option>
                              <option value="committee">Committee</option>
                            </select>
                            <button
                              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium"
                              type="submit"
                            >
                              Grant role
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            {profiles.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No profiles have logged in yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
