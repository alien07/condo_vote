"use server";

import {
  createClient,
  getRelatedProfileEmail,
  insertEmailLogs,
  normalizeEmail,
  requiredText,
  requireAdmin,
  revalidateAdminPaths,
  type EmailInviteState,
} from "@/features/admin/action-modules/shared";

export async function resendVoteInvitation(
  _previousState: EmailInviteState,
  formData: FormData,
): Promise<EmailInviteState> {
  await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return { error: "Recipient email is required." };
  }

  const supabase = await createClient();

  const [meetingResult, profileResult] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, status")
      .eq("id", meetingId)
      .single(),
    supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle(),
  ]);

  if (meetingResult.error) {
    return { error: meetingResult.error.message };
  }

  if (profileResult.error) {
    return { error: profileResult.error.message };
  }

  if (meetingResult.data.status !== "published") {
    return { error: "Vote invitation links can only be resent for published meetings." };
  }

  if (!profileResult.data) {
    return { error: `No profile found for ${email}.` };
  }

  const { data: eligible, error: eligibleError } = await supabase
    .from("eligible_voters_snapshot")
    .select("room_id, voter_type")
    .eq("meeting_id", meetingId)
    .eq("profile_id", profileResult.data.id)
    .maybeSingle();

  if (eligibleError) {
    return { error: eligibleError.message };
  }

  if (!eligible || !["owner", "proxy"].includes(eligible.voter_type)) {
    return {
      error: `${email} is not an owner/proxy eligible voter for this meeting.`,
    };
  }

  await insertEmailLogs([
    {
      recipient_email: email,
      template_key: `vote_invitation:${meetingId}`,
      status: "queued",
    },
  ]);
  revalidateAdminPaths();

  return { message: `Queued vote invitation for ${email}.` };
}

export async function queueVoteInvitationGroup(
  _previousState: EmailInviteState,
  formData: FormData,
): Promise<EmailInviteState> {
  await requireAdmin();

  const meetingId = requiredText(formData.get("meeting_id"), "Meeting");
  const groupMode = requiredText(formData.get("group_mode"), "Group mode");
  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, status")
    .eq("id", meetingId)
    .single();

  if (meetingError) {
    return { error: meetingError.message };
  }

  if (!["eligible", "all_active"].includes(groupMode)) {
    return { error: "Invalid group resend mode." };
  }

  if (groupMode === "eligible" && meeting.status !== "published") {
    return { error: "Eligible voter links can only be queued for published meetings." };
  }

  const { data: eligibleRows, error: eligibleError } = await supabase
    .from("eligible_voters_snapshot")
    .select("voter_type, profiles(email)")
    .eq("meeting_id", meetingId);

  if (eligibleError) {
    return { error: eligibleError.message };
  }

  const voteEmails = new Set(
    eligibleRows
      .filter((row) => row.voter_type === "owner" || row.voter_type === "proxy")
      .map((row) => getRelatedProfileEmail(row.profiles))
      .filter((email): email is string => Boolean(email)),
  );

  const logsByEmail = new Map<
    string,
    {
      recipient_email: string;
      template_key: string;
      status: string;
    }
  >();

  if (groupMode === "eligible") {
    for (const email of voteEmails) {
      logsByEmail.set(email, {
        recipient_email: email,
        template_key: `vote_invitation:${meetingId}`,
        status: "queued",
      });
    }
  } else {
    const [ownersResult, residentsResult] = await Promise.all([
      supabase
        .from("owners")
        .select("email")
        .eq("active", true)
        .not("email", "is", null),
      supabase
        .from("profiles")
        .select("email")
        .eq("approval_status", "approved")
        .eq("default_status", "resident"),
    ]);

    if (ownersResult.error) {
      return { error: ownersResult.error.message };
    }

    if (residentsResult.error) {
      return { error: residentsResult.error.message };
    }

    for (const owner of ownersResult.data) {
      const email = owner.email?.trim().toLowerCase();

      if (!email) {
        continue;
      }

      logsByEmail.set(email, {
        recipient_email: email,
        template_key:
          meeting.status === "published" && voteEmails.has(email)
            ? `vote_invitation:${meetingId}`
            : `vote_fyi:${meetingId}`,
        status: "queued",
      });
    }

    for (const resident of residentsResult.data) {
      const email = resident.email.trim().toLowerCase();

      if (!logsByEmail.has(email)) {
        logsByEmail.set(email, {
          recipient_email: email,
          template_key: `vote_fyi:${meetingId}`,
          status: "queued",
        });
      }
    }
  }

  const rows = [...logsByEmail.values()];

  if (rows.length === 0) {
    return { error: "No recipients matched this resend policy." };
  }

  await insertEmailLogs(rows);
  revalidateAdminPaths();

  return { message: `Queued ${rows.length} email event(s).` };
}
