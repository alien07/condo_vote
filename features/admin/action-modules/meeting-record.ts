"use server";

import { revalidatePath } from "next/cache";
import { getStaffI18n } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/business-audit";
import { requireAdmin } from "@/lib/auth/permissions";
import { bangkokLocalToIso } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

// Meeting record details for the official result record (document 1):
// notice date, first or reconvened meeting, identity method, recording and
// traffic log references, and incidents during voting.

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value ? value : null;
}

async function recordText() {
  return (await getStaffI18n()).s.meetings.recordMessages;
}

function recordHref(meetingId: string, tone: "success" | "error", message: string) {
  return `/admin/meetings/${meetingId}/record?feedback=${tone}&message=${encodeURIComponent(message)}`;
}

function done(meetingId: string, tone: "success" | "error", message: string): never {
  revalidatePath(`/admin/meetings/${meetingId}/record`);
  redirect(recordHref(meetingId, tone, message));
}

export async function saveMeetingRecord(formData: FormData) {
  const admin = await requireAdmin();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const noticeInput = text(formData, "notice_sent_at");
  const noticeSentAt = bangkokLocalToIso(noticeInput);
  const meetingRound = text(formData, "meeting_round") ?? "first";

  if (noticeInput && !noticeSentAt) {
    done(meetingId, "error", (await recordText()).badNotice);
  }

  if (!["first", "reconvened"].includes(meetingRound)) {
    done(meetingId, "error", (await recordText()).badRound);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({
      notice_sent_at: noticeSentAt,
      meeting_round: meetingRound,
      identity_method: text(formData, "identity_method"),
      recording_reference: text(formData, "recording_reference"),
      traffic_log_reference: text(formData, "traffic_log_reference"),
    })
    .eq("id", meetingId);

  if (error) {
    done(meetingId, "error", error.message);
  }

  await writeAuditLog(supabase, {
    action: "meeting.record_updated",
    actorProfileId: admin.id,
    details: { meeting_round: meetingRound },
    entityId: meetingId,
    entityType: "meeting",
  });

  done(meetingId, "success", (await recordText()).saved);
}

export async function addMeetingIncident(formData: FormData) {
  const admin = await requireAdmin();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const startedAt = bangkokLocalToIso(text(formData, "started_at"));
  const endedInput = text(formData, "ended_at");
  const endedAt = bangkokLocalToIso(endedInput);
  const description = text(formData, "description");

  if (!startedAt || !description) {
    done(meetingId, "error", (await recordText()).incidentRequired);
  }

  if (endedInput && (!endedAt || endedAt < startedAt)) {
    done(meetingId, "error", (await recordText()).incidentEnd);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_incidents")
    .insert({
      meeting_id: meetingId,
      started_at: startedAt,
      ended_at: endedAt,
      description,
      action_taken: text(formData, "action_taken"),
    })
    .select("id")
    .single();

  if (error) {
    done(meetingId, "error", error.message);
  }

  await writeAuditLog(supabase, {
    action: "meeting.incident_added",
    actorProfileId: admin.id,
    details: { meeting_id: meetingId },
    entityId: data.id,
    entityType: "meeting_incident",
  });

  done(meetingId, "success", (await recordText()).incidentAdded);
}

export async function deleteMeetingIncident(formData: FormData) {
  const admin = await requireAdmin();
  const meetingId = String(formData.get("meeting_id") ?? "");
  const incidentId = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_incidents").delete().eq("id", incidentId);

  if (error) {
    done(meetingId, "error", error.message);
  }

  await writeAuditLog(supabase, {
    action: "meeting.incident_deleted",
    actorProfileId: admin.id,
    details: { meeting_id: meetingId },
    entityId: incidentId,
    entityType: "meeting_incident",
  });

  done(meetingId, "success", (await recordText()).incidentRemoved);
}
