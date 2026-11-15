// Results, approvals and correction test cases.
import "./meetings.mjs"; // runs after the previous step

import { db, must, sessionFor, DEMO_SYSTEM_ADMIN, buildResultPayload } from "./context.mjs";
import { personaEmail, condo } from "./people.mjs";
import { admin, meetingIds } from "./meeting-builder.mjs";

// ---------------------------------------------------------------- results

console.log("[demo:seed] results ...");

export const adminSession = await sessionFor(personaEmail.admin);
export const committeeSession = await sessionFor(personaEmail.committee);
export const sysSession = await sessionFor(DEMO_SYSTEM_ADMIN.email);

/** Same reads and payload as "Generate result" in the admin app. */
export async function generateResult(meetingId) {
  const [meeting, questions, eligible, ballots, manualBallots, resolutions, condoRows, incidents] =
    await Promise.all([
      must(db.from("meetings").select("id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule, ballot_secrecy, advance_starts_at, advance_ends_at, notice_sent_at, meeting_round, identity_method, recording_reference, traffic_log_reference, title_en, location_en").eq("id", meetingId).single(), "meeting"),
      must(db.from("meeting_questions").select("id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, pass_basis, pass_operator, pass_percent, requires_land_office_registration, legal_note, display_order, agenda_title_en, question_text_en, legal_note_en, meeting_choices(id, choice_text, choice_text_en, display_order, is_abstain)").eq("meeting_id", meetingId).order("display_order"), "questions"),
      must(db.from("eligible_voters_snapshot").select("room_id, ownership_percent, voter_type").eq("meeting_id", meetingId), "eligible"),
      must(db.from("ballots").select("id, room_id, status, submitted_at").eq("meeting_id", meetingId).eq("status", "submitted"), "ballots"),
      must(db.from("manual_ballots").select("id, room_id, source_label, audit_note, identity_status, voter_profile_id, voter_identity_text, manual_ballot_answers(question_id, choice_id)").eq("meeting_id", meetingId).eq("status", "submitted").neq("identity_status", "pending"), "manual"),
      must(db.from("vote_source_resolutions").select("room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at").eq("meeting_id", meetingId), "resolutions"),
      must(db.from("condo_profiles").select("project_name, juristic_name, registration_no, tax_id, address, manager_name, project_name_en, juristic_name_en").order("created_at", { ascending: false }).limit(1), "condo"),
      must(db.from("meeting_incidents").select("started_at, ended_at, description, action_taken").eq("meeting_id", meetingId).order("started_at"), "incidents"),
    ]);
  const onlineTally = await must(
    adminSession.rpc("meeting_online_tally", { p_meeting_id: meetingId }),
    "online tally",
  );
  const { payload } = buildResultPayload({
    meeting,
    condo: condoRows[0] ?? null,
    incidents,
    questions,
    eligible,
    ballots,
    manualBallots,
    resolutions,
    onlineTally: onlineTally ?? [],
    quorumRule: meeting.quorum_rule,
  });
  const snapshot = await must(
    db
      .from("result_snapshots")
      .insert({ meeting_id: meetingId, generated_by: admin, payload_json: payload })
      .select("id")
      .single(),
    "result snapshot",
  );
  return snapshot.id;
}

export async function approve(session, snapshotId, notes) {
  await must(
    session.rpc("approve_result_snapshot", { p_result_snapshot_id: snapshotId, p_notes: notes }),
    "approve result",
  );
}

// Oldest first, so publication times follow the meetings. The owner summary
// opens on the newest meeting (M9) and lists the history by meeting date.
export const m10 = await generateResult(meetingIds.M10);
await approve(committeeSession, m10, null);

export const m9 = await generateResult(meetingIds.M9);
await approve(committeeSession, m9, null);

export const m7 = await generateResult(meetingIds.M7);
await approve(committeeSession, m7, "ตรวจแล้วถูกต้อง (คนที่ 1)");

export const m8 = await generateResult(meetingIds.M8);
await approve(committeeSession, m8, "ตรวจแล้วถูกต้อง");
await approve(sysSession, m8, "อนุมัติเผยแพร่");

await must(db.from("meetings").update({ status: "archived" }).eq("id", meetingIds.M10), "archive M10");

// Correction test cases (review 2026-11-15). The requester is the System
// Admin (Google), so the Demo Committee can still act and the Demo Admin
// can answer (nobody answers their own request).
export async function requestCorrection(snapshotId, category, reason) {
  const result = await must(
    sysSession.rpc("request_result_correction", {
      p_result_snapshot_id: snapshotId,
      p_category: category,
      p_reason: reason,
      p_legal_reference: null,
    }),
    "correction request",
  );
  return result.request_id;
}

// M11: nobody has approved yet.
await generateResult(meetingIds.M11);

// M12: a medium correction is open. Demo Committee's approval completes the
// count (1 of 1) but the result waits; Demo Admin answers "No change needed"
// in Admin > Results to publish it.
export const m12 = await generateResult(meetingIds.M12);
await requestCorrection(m12, "room_data", "อัตราส่วนกรรมสิทธิ์ห้อง A-104 ไม่ตรงกับหนังสือรับรอง (ข้อมูลทดสอบ)");

// M13: agenda 1 had a typo; after the correction the admin fixed the
// wording and generated the result again, so approvals start from 0.
export const m13Agenda = await must(
  db.from("meeting_questions").select("id, agenda_title").eq("meeting_id", meetingIds.M13).order("display_order").limit(1).single(),
  "M13 agenda",
);
await must(db.from("meeting_questions").update({ agenda_title: "งบการเงน" }).eq("id", m13Agenda.id), "M13 typo");
export const m13Old = await generateResult(meetingIds.M13);
await approve(committeeSession, m13Old, "ตรวจแล้ว");
export const m13Request = await requestCorrection(m13Old, "wording", "วาระที่ 1 ชื่อวาระพิมพ์ผิด: งบการเงน");
await must(db.from("meeting_questions").update({ agenda_title: m13Agenda.agenda_title }).eq("id", m13Agenda.id), "M13 fix");
await generateResult(meetingIds.M13);
await must(
  adminSession.rpc("answer_correction_request", {
    p_request_id: m13Request,
    p_status: "fixed",
    p_answer: "แก้ชื่อวาระแล้ว และสร้างผลใหม่",
  }),
  "M13 answer",
);
