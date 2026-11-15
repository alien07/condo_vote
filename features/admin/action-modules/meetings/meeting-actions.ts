"use server";

import { englishGaps, getEnglishMeeting } from "@/features/english/data";
import { getStaffI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import {
  createClient,
  optionalText,
  requiredDateTime,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
} from "@/features/admin/action-modules/shared";
import { writeAuditLog } from "@/lib/audit/business-audit";
import {
  type MeetingActionState,
  meetingFormValues,
  validateMeetingForm,
  meetingValidationState,
  meetingPayload,
} from "@/features/admin/action-modules/meetings/helpers";

export async function createMeetingWithState(
  _state: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const values = meetingFormValues(formData);

  try {
    await requireAdmin();
    const validation = meetingValidationState(
      validateMeetingForm(values, false),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meetings")
      .insert(meetingPayload(values))
      .select("id")
      .single();

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: data.id,
      success: "Meeting added",
      values,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not add meeting.",
      values,
    };
  }
}

export async function updateDraftMeetingWithState(
  _state: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const values = meetingFormValues(formData);

  try {
    await requireAdmin();
    const validation = meetingValidationState(
      validateMeetingForm(values, true),
      values,
    );

    if (validation) {
      return validation;
    }

    const supabase = await createClient();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("status")
      .eq("id", values.id)
      .single();

    if (meetingError) {
      return { error: meetingError.message, values };
    }

    if (meeting.status !== "draft") {
      return { error: "Only draft meetings can be edited.", values };
    }

    const { error } = await supabase
      .from("meetings")
      .update(meetingPayload(values))
      .eq("id", values.id);

    if (error) {
      return { error: error.message, values };
    }

    revalidateAdminPaths();
    return {
      recordId: values.id,
      success: "Meeting updated",
      values,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update meeting.",
      values,
    };
  }
}

export async function createMeeting(formData: FormData) {
  await requireAdmin();

  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");
  const title = requiredText(formData.get("title"), "Meeting title");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title,
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

  revalidateAdminPaths();
  redirect(
    `/admin/meetings?tab=meetings&title=${encodeURIComponent(title)}&feedback=success&message=${encodeURIComponent("Meeting added")}`,
  );
}

export async function updateDraftMeeting(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Meeting ID");
  const startsAt = requiredDateTime(formData.get("starts_at"), "Start time");
  const endsAt = requiredDateTime(formData.get("ends_at"), "End time");

  if (new Date(startsAt) >= new Date(endsAt)) {
    throw new Error("End time must be after start time.");
  }

  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("status")
    .eq("id", id)
    .single();

  if (meetingError) {
    throw meetingError;
  }

  if (meeting.status !== "draft") {
    throw new Error("Only draft meetings can be edited.");
  }

  const { error } = await supabase
    .from("meetings")
    .update({
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
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateAdminPaths();
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

  revalidateAdminPaths();
}

export async function publishMeeting(formData: FormData) {
  const admin = await requireAdmin();

  const meetingId = requiredText(formData.get("id"), "Meeting ID");
  const supabase = await createClient();

  // Two-language documents (item 6b): English must be filled in and checked
  // before publishing. Checked here, not when saving a draft.
  const { data: condoSettings } = await supabase
    .from("condo_profiles")
    .select("bilingual_documents")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (condoSettings?.bilingual_documents) {
    const englishMeeting = await getEnglishMeeting(meetingId);
    const gaps = englishMeeting ? englishGaps(englishMeeting) : { missing: true, unchecked: true };

    if (gaps.missing || gaps.unchecked) {
      const { s } = await getStaffI18n();
      redirect(
        `/admin/meetings/${meetingId}/english?feedback=error&message=${encodeURIComponent(s.english.publishBlocked)}`,
      );
    }
  }

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
    // One owner of record per room (item 15); the oldest link first, so the
    // same owner is picked every time.
    supabase
      .from("room_owners")
      .select("room_id, owners(email)")
      .is("ends_at", null)
      .eq("ownership_role", "owner")
      .order("created_at", { ascending: true }),
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

  await writeAuditLog(supabase, {
    action: "meeting.published",
    actorProfileId: admin.id,
    details: {
      eligible_voter_count: rows.length,
    },
    entityId: meetingId,
    entityType: "meeting",
  });
  revalidateAdminPaths();
}
