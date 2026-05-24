"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  return text ? Number(text) : null;
}

function requiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

function requiredDateTime(value: FormDataEntryValue | null, fieldName: string) {
  const text = requiredText(value, fieldName);
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date and time.`);
  }

  return date.toISOString();
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return text;
}

function optionalBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

async function queueResultApprovedEmails(meetingId: string) {
  const supabase = await createClient();
  const [ownersResult, residentsResult, existingLogsResult] = await Promise.all([
    supabase
      .from("owners")
      .select("email, created_at")
      .eq("active", true)
      .not("email", "is", null),
    supabase
      .from("profiles")
      .select("email, created_at")
      .eq("approval_status", "approved")
      .eq("default_status", "resident"),
    supabase
      .from("email_logs")
      .select("recipient_email")
      .eq("template_key", `result_approved:${meetingId}`),
  ]);

  if (ownersResult.error) {
    throw ownersResult.error;
  }

  if (residentsResult.error) {
    throw residentsResult.error;
  }

  if (existingLogsResult.error) {
    throw existingLogsResult.error;
  }

  const existingRecipients = new Set(
    existingLogsResult.data.map((log) => log.recipient_email.toLowerCase()),
  );
  const recipientsByEmail = new Map<
    string,
    {
      email: string;
      activeAt: string;
    }
  >();

  for (const owner of ownersResult.data) {
    const email = owner.email?.trim().toLowerCase();

    if (email) {
      recipientsByEmail.set(email, {
        email,
        activeAt: owner.created_at,
      });
    }
  }

  for (const resident of residentsResult.data) {
    const email = resident.email.trim().toLowerCase();
    const current = recipientsByEmail.get(email);

    if (!current || current.activeAt < resident.created_at) {
      recipientsByEmail.set(email, {
        email,
        activeAt: resident.created_at,
      });
    }
  }

  const rows = [...recipientsByEmail.values()]
    .filter((recipient) => !existingRecipients.has(recipient.email))
    .sort((left, right) => right.activeAt.localeCompare(left.activeAt))
    .map((recipient) => ({
      recipient_email: recipient.email,
      template_key: `result_approved:${meetingId}`,
      status: "queued",
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("email_logs").insert(rows);

  if (error) {
    throw error;
  }
}

export async function saveCondoProfile(formData: FormData) {
  await requireAdmin();

  const id = optionalText(formData.get("id"));
  const values = {
    juristic_name: requiredText(formData.get("juristic_name"), "Juristic name"),
    project_name: requiredText(formData.get("project_name"), "Project name"),
    registration_no: optionalText(formData.get("registration_no")),
    tax_id: optionalText(formData.get("tax_id")),
    address: optionalText(formData.get("address")),
    phone: optionalText(formData.get("phone")),
    email: optionalText(formData.get("email")),
    manager_name: optionalText(formData.get("manager_name")),
    document_footer: optionalText(formData.get("document_footer")),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("condo_profiles").update(values).eq("id", id)
    : await supabase.from("condo_profiles").insert(values);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createCommitteeMember(formData: FormData) {
  await requireAdmin();

  const profileId = optionalText(formData.get("profile_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("committee_members").insert({
    profile_id: profileId,
    full_name: requiredText(formData.get("full_name"), "Full name"),
    position_title: requiredText(formData.get("position_title"), "Position"),
    term_starts_at: optionalDate(formData.get("term_starts_at")),
    term_ends_at: optionalDate(formData.get("term_ends_at")),
    display_order: Number(formData.get("display_order") ?? 0),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deactivateCommitteeMember(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Committee member ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("committee_members")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createRoom(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({
    room_number: requiredText(formData.get("room_number"), "Room number"),
    floor: optionalText(formData.get("floor")),
    building: optionalText(formData.get("building")),
    area_size: optionalNumber(formData.get("area_size")),
    ownership_percent: requiredNumber(
      formData.get("ownership_percent"),
      "Ownership percentage",
    ),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createMeeting(formData: FormData) {
  await requireAdmin();

  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title: requiredText(formData.get("title"), "Meeting title"),
    description: optionalText(formData.get("description")),
    video_url: optionalText(formData.get("video_url")),
    starts_at: startsAt,
    ends_at: endsAt,
    meeting_number: optionalText(formData.get("meeting_number")),
    meeting_type: requiredText(formData.get("meeting_type"), "Meeting type"),
    fiscal_year: optionalText(formData.get("fiscal_year")),
    location: optionalText(formData.get("location")),
    chairperson_name: optionalText(formData.get("chairperson_name")),
    quorum_rule: requiredText(formData.get("quorum_rule"), "Quorum rule"),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function archiveMeeting(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deactivateRoom(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Room ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createOwner(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("owners").insert({
    full_name: requiredText(formData.get("full_name"), "Full name"),
    email: optionalText(formData.get("email")),
    phone: optionalText(formData.get("phone")),
    line_id: optionalText(formData.get("line_id")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deactivateOwner(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Owner ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function linkRoomOwner(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("room_owners").insert({
    room_id: requiredText(formData.get("room_id"), "Room"),
    owner_id: requiredText(formData.get("owner_id"), "Owner"),
    ownership_role: requiredText(formData.get("ownership_role"), "Role"),
    starts_at: optionalDate(formData.get("starts_at")),
    ends_at: optionalDate(formData.get("ends_at")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function endRoomOwnerLink(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Room owner link ID");
  const endsAt = optionalDate(formData.get("ends_at")) ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_owners")
    .update({ ends_at: endsAt })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function updateProfileApproval(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Profile ID");
  const defaultStatus = requiredText(formData.get("default_status"), "Default status");
  const approvalStatus = requiredText(
    formData.get("approval_status"),
    "Approval status",
  );
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      default_status: defaultStatus,
      approval_status: approvalStatus,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function grantAppRole(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("app_roles").upsert(
    {
      profile_id: requiredText(formData.get("profile_id"), "Profile"),
      role: requiredText(formData.get("role"), "Role"),
    },
    { onConflict: "profile_id,role" },
  );

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function revokeAppRole(formData: FormData) {
  const admin = await requireAdmin();

  const id = requiredText(formData.get("id"), "Role ID");
  const supabase = await createClient();
  const { data: role, error: roleError } = await supabase
    .from("app_roles")
    .select("profile_id, role")
    .eq("id", id)
    .single();

  if (roleError) {
    throw roleError;
  }

  if (role.profile_id === admin.id && role.role === "admin") {
    throw new Error("Cannot revoke your own admin role.");
  }

  const { error } = await supabase.from("app_roles").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createProxyAuthorization(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("proxy_authorizations").insert({
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    room_id: requiredText(formData.get("room_id"), "Room"),
    owner_id: optionalText(formData.get("owner_id")),
    proxy_profile_id: requiredText(formData.get("proxy_profile_id"), "Proxy profile"),
    valid_from: optionalDate(formData.get("valid_from")),
    valid_until: optionalDate(formData.get("valid_until")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function reviewProxyAuthorization(formData: FormData) {
  const reviewer = await requireAdmin();

  const id = requiredText(formData.get("id"), "Proxy authorization ID");
  const status = requiredText(formData.get("status"), "Status");
  const supabase = await createClient();
  const { error } = await supabase
    .from("proxy_authorizations")
    .update({
      status,
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_questions").insert({
    meeting_id: requiredText(formData.get("meeting_id"), "Meeting"),
    agenda_no: optionalText(formData.get("agenda_no")),
    agenda_title: optionalText(formData.get("agenda_title")),
    question_text: requiredText(formData.get("question_text"), "Question"),
    question_type: requiredText(formData.get("question_type"), "Question type"),
    resolution_type: requiredText(
      formData.get("resolution_type"),
      "Resolution type",
    ),
    required_threshold: requiredText(
      formData.get("required_threshold"),
      "Required threshold",
    ),
    requires_land_office_registration: optionalBoolean(
      formData.get("requires_land_office_registration"),
    ),
    legal_note: optionalText(formData.get("legal_note")),
    display_order: Number(formData.get("display_order") ?? 0),
    required: optionalBoolean(formData.get("required")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deleteMeetingQuestion(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Question ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_questions").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createMeetingChoice(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").insert({
    question_id: requiredText(formData.get("question_id"), "Question"),
    choice_text: requiredText(formData.get("choice_text"), "Choice"),
    display_order: Number(formData.get("display_order") ?? 0),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deleteMeetingChoice(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Choice ID");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_choices").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function publishMeeting(formData: FormData) {
  await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();

  const [
    roomsResult,
    profilesResult,
    roomOwnersResult,
    proxyAuthorizationsResult,
  ] = await Promise.all([
    supabase.from("rooms").select("id, ownership_percent").eq("active", true),
    supabase
      .from("profiles")
      .select("id, email, default_status, approval_status")
      .eq("approval_status", "approved"),
    supabase
      .from("room_owners")
      .select("room_id, owners(email)")
      .is("ends_at", null),
    supabase
      .from("proxy_authorizations")
      .select("room_id, proxy_profile_id, rooms(ownership_percent)")
      .eq("meeting_id", meetingId)
      .eq("status", "approved"),
  ]);

  if (roomsResult.error) {
    throw roomsResult.error;
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (roomOwnersResult.error) {
    throw roomOwnersResult.error;
  }

  if (proxyAuthorizationsResult.error) {
    throw proxyAuthorizationsResult.error;
  }

  const profilesByEmail = new Map(
    profilesResult.data.map((profile) => [profile.email.toLowerCase(), profile]),
  );
  const ownershipByRoom = new Map(
    roomsResult.data.map((room) => [room.id, room.ownership_percent]),
  );
  const snapshotRows = new Map<
    string,
    {
      meeting_id: string;
      room_id: string;
      profile_id: string;
      voter_type: string;
      ownership_percent: number;
      source: string;
    }
  >();

  for (const link of roomOwnersResult.data) {
    const ownerEmail = link.owners?.email?.toLowerCase();
    const profile = ownerEmail ? profilesByEmail.get(ownerEmail) : null;
    const ownershipPercent = ownershipByRoom.get(link.room_id);

    if (
      profile?.default_status === "owner" &&
      ownershipPercent &&
      !snapshotRows.has(link.room_id)
    ) {
      snapshotRows.set(link.room_id, {
        meeting_id: meetingId,
        room_id: link.room_id,
        profile_id: profile.id,
        voter_type: "owner",
        ownership_percent: ownershipPercent,
        source: "owner_master",
      });
    }
  }

  for (const authorization of proxyAuthorizationsResult.data) {
    const ownershipPercent = authorization.rooms?.ownership_percent;

    if (ownershipPercent) {
      snapshotRows.set(authorization.room_id, {
        meeting_id: meetingId,
        room_id: authorization.room_id,
        profile_id: authorization.proxy_profile_id,
        voter_type: "proxy",
        ownership_percent: ownershipPercent,
        source: "proxy_authorization",
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("eligible_voters_snapshot")
    .delete()
    .eq("meeting_id", meetingId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = [...snapshotRows.values()];

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("eligible_voters_snapshot")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", meetingId);

  if (meetingError) {
    throw meetingError;
  }

  revalidatePath("/admin");
}

export async function generateResultSnapshot(formData: FormData) {
  const generator = await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();

  const [meetingResult, questionsResult, eligibleResult, ballotsResult] =
    await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule",
        )
        .eq("id", meetingId)
        .single(),
      supabase
        .from("meeting_questions")
        .select(
          "id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, requires_land_office_registration, legal_note, display_order, meeting_choices(id, choice_text, display_order)",
        )
        .eq("meeting_id", meetingId)
        .order("display_order", { ascending: true }),
      supabase
        .from("eligible_voters_snapshot")
        .select("room_id, ownership_percent")
        .eq("meeting_id", meetingId),
      supabase
        .from("ballots")
        .select("id, room_id, status, ballot_answers(question_id, choice_id)")
        .eq("meeting_id", meetingId)
        .eq("status", "submitted"),
    ]);

  if (meetingResult.error) {
    throw meetingResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  if (eligibleResult.error) {
    throw eligibleResult.error;
  }

  if (ballotsResult.error) {
    throw ballotsResult.error;
  }

  const ownershipByRoom = new Map(
    eligibleResult.data.map((eligible) => [
      eligible.room_id,
      toNumber(eligible.ownership_percent),
    ]),
  );
  const submittedRoomIds = new Set(ballotsResult.data.map((ballot) => ballot.room_id));
  const totalEligibleOwnership = [...ownershipByRoom.values()].reduce(
    (sum, ownership) => sum + ownership,
    0,
  );
  const submittedOwnership = [...submittedRoomIds].reduce(
    (sum, roomId) => sum + (ownershipByRoom.get(roomId) ?? 0),
    0,
  );
  const countsByChoice = new Map<
    string,
    {
      voteCount: number;
      ownership: number;
    }
  >();

  for (const ballot of ballotsResult.data) {
    const ownership = ownershipByRoom.get(ballot.room_id) ?? 0;

    for (const answer of ballot.ballot_answers) {
      const current = countsByChoice.get(answer.choice_id) ?? {
        voteCount: 0,
        ownership: 0,
      };

      countsByChoice.set(answer.choice_id, {
        voteCount: current.voteCount + 1,
        ownership: current.ownership + ownership,
      });
    }
  }

  const payload = {
    meeting: meetingResult.data,
    generated_at: new Date().toISOString(),
    totals: {
      eligible_voters: eligibleResult.data.length,
      submitted_ballots: ballotsResult.data.length,
      total_eligible_ownership: totalEligibleOwnership,
      submitted_ownership: submittedOwnership,
    },
    questions: questionsResult.data.map((question) => ({
      id: question.id,
      agenda_no: question.agenda_no,
      agenda_title: question.agenda_title,
      text: question.question_text,
      type: question.question_type,
      resolution_type: question.resolution_type,
      required_threshold: question.required_threshold,
      requires_land_office_registration:
        question.requires_land_office_registration,
      legal_note: question.legal_note,
      choices: question.meeting_choices
        .sort((left, right) => left.display_order - right.display_order)
        .map((choice) => {
          const count = countsByChoice.get(choice.id) ?? {
            voteCount: 0,
            ownership: 0,
          };

          return {
            id: choice.id,
            text: choice.choice_text,
            vote_count: count.voteCount,
            ownership: count.ownership,
            percent_of_total_ownership:
              totalEligibleOwnership > 0
                ? (count.ownership / totalEligibleOwnership) * 100
                : 0,
            percent_of_submitted_ownership:
              submittedOwnership > 0
                ? (count.ownership / submittedOwnership) * 100
                : 0,
          };
        }),
    })),
  };

  const { error: insertError } = await supabase.from("result_snapshots").insert({
    meeting_id: meetingId,
    generated_by: generator.id,
    payload_json: payload,
  });

  if (insertError) {
    throw insertError;
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "closed" })
    .eq("id", meetingId)
    .neq("status", "archived");

  if (meetingError) {
    throw meetingError;
  }

  revalidatePath("/admin");
}

export async function approveResultSnapshot(formData: FormData) {
  const approver = await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting ID");
  const resultSnapshotId = requiredText(
    formData.get("result_snapshot_id"),
    "Result snapshot ID",
  );
  const supabase = await createClient();
  const { error } = await supabase.from("committee_approvals").insert({
    meeting_id: meetingId,
    result_snapshot_id: resultSnapshotId,
    approved_by: approver.id,
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    throw error;
  }

  await queueResultApprovedEmails(meetingId);

  revalidatePath("/admin");
}
