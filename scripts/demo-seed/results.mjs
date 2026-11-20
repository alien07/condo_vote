// Results, committee answers (D027) and the other states that need a
// signed-in person: the co-owner grant and the short-notice confirmation.
import "./meetings.mjs"; // runs after the previous step

import { db, must, sessionFor, DAY, HOUR, at, buildResultPayload } from "./context.mjs";
import { personaEmail, personaProfile, EXTRA_MEMBERS, roomId } from "./people.mjs";
import { admin, meetingIds } from "./meeting-builder.mjs";

// ---------------------------------------------------------------- results

console.log("[demo:seed] results ...");

export const managerSession = await sessionFor(personaEmail.manager);
const memberEmail = Object.fromEntries(EXTRA_MEMBERS.map((member) => [member.key, member.email]));
export const sessions = {
  chair: await sessionFor(personaEmail.chair),
  viceChair: await sessionFor(personaEmail.viceChair),
  member: await sessionFor(personaEmail.member),
  member4: await sessionFor(memberEmail.member4),
  member5: await sessionFor(memberEmail.member5),
};

/** Same reads and payload as "Generate result" in the admin app. */
export async function generateResult(meetingId, generatedBy = admin) {
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
    managerSession.rpc("meeting_online_tally", { p_meeting_id: meetingId }),
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
      .insert({ meeting_id: meetingId, generated_by: generatedBy, payload_json: payload })
      .select("id")
      .single(),
    "result snapshot",
  );
  return snapshot.id;
}

export async function approve(who, snapshotId, notes = null) {
  await must(
    sessions[who].rpc("approve_result_snapshot", { p_result_snapshot_id: snapshotId, p_notes: notes ?? "" }),
    `approve result (${who})`,
  );
}

export async function object(who, snapshotId, reason) {
  await must(
    sessions[who].rpc("object_result_snapshot", { p_result_snapshot_id: snapshotId, p_reason: reason }),
    `object to result (${who})`,
  );
}

// Oldest first, so publication times follow the meetings. Published results
// need 3 of the 5 members (D027).
export const m15 = await generateResult(meetingIds.M15);
for (const who of ["chair", "viceChair", "member4"]) await approve(who, m15);
await must(db.from("meetings").update({ status: "archived" }).eq("id", meetingIds.M15), "archive M15");

export const m13 = await generateResult(meetingIds.M13);
await approve("chair", m13, "ตรวจแล้วถูกต้อง");
await approve("viceChair", m13);
await approve("member4", m13, "ตรวจสอบกับบัตรแล้ว");

export const m14 = await generateResult(meetingIds.M14);
for (const who of ["chair", "viceChair", "member4"]) await approve(who, m14);

// M9: 2 of 3; Mark Member's approval publishes it.
export const m9 = await generateResult(meetingIds.M9);
await approve("chair", m9, "ตรวจแล้ว");
await approve("viceChair", m9);

// M10: not passed. The Manager gets the email and sees the reasons.
export const m10 = await generateResult(meetingIds.M10);
await approve("chair", m10);
await object("viceChair", m10, "จำนวนห้องที่ลงคะแนนไม่ตรงกับทะเบียนผู้เข้าประชุม (ข้อมูลทดสอบ)");
await object("member4", m10, "บัตรกระดาษห้อง A-205 ยังไม่ได้นับ (ข้อมูลทดสอบ)");
await object("member5", m10, "ขอให้ตรวจอัตราส่วนกรรมสิทธิ์อีกครั้ง (ข้อมูลทดสอบ)");

// M11: a tie. The fifth member generated it (D022), so may not answer.
export const m11 = await generateResult(meetingIds.M11, personaProfile.member5);
await approve("viceChair", m11);
await approve("member4", m11);
await object("chair", m11, "ตัวเลือกวาระที่ 2 พิมพ์ไม่ตรงกับหนังสือเชิญ (ข้อมูลทดสอบ)");
await object("member", m11, "Quorum figure looks wrong to me (test data).");

// M12: a medium correction request by Mark Member waits for the Manager;
// the vice chair approved already.
export const m12 = await generateResult(meetingIds.M12);
await approve("viceChair", m12);
await must(
  sessions.member.rpc("request_result_correction", {
    p_result_snapshot_id: m12,
    p_category: "room_data",
    p_reason: "Ownership share of room A-104 differs from the title deed (test data).",
    p_legal_reference: null,
  }),
  "correction request",
);

// ---------------------------------------------------------------- other states

// M1: the owner of A-110 lets the co-owner vote (Vote page, D022).
const ownerCoSession = await sessionFor(personaEmail.ownerCo);
await must(
  ownerCoSession.rpc("grant_co_owner_vote", {
    p_meeting_id: meetingIds.M1,
    p_room_id: roomId["A-110"],
    p_co_owner_email: personaEmail.coOwner,
  }),
  "co-owner vote",
);

// M5: published with short notice; the Manager confirmed the warning (D027 C).
await must(
  db.from("audit_logs").insert({
    action: "meeting.published",
    actor_profile_id: admin,
    entity_type: "meeting",
    entity_id: meetingIds.M5,
    details_json: { eligible_voter_count: 20, short_notice_confirmed: true, days_left: 4, notice_days: 7 },
    created_at: at(-HOUR),
  }),
  "short notice audit",
);

// A past temporary access by the demo System Admin, ended early (D027 B).
const sysAccess = await must(
  db
    .from("system_read_access")
    .insert({
      profile_id: personaProfile.systemAdmin,
      reason: "ตรวจปัญหาอีเมลเชิญไม่ถึงห้อง A-110 (ข้อมูลทดสอบ)",
      starts_at: at(-3 * DAY),
      ends_at: at(-3 * DAY + 4 * 60 * 60 * 1000),
      ended_at: at(-3 * DAY + 60 * 60 * 1000),
      end_kind: "ended_early",
    })
    .select("id")
    .single(),
  "system access",
);
await must(
  db.from("audit_logs").insert([
    { action: "system_access.started", actor_profile_id: personaProfile.systemAdmin, entity_type: "system_read_access", entity_id: sysAccess.id, details_json: { reason: "ตรวจปัญหาอีเมลเชิญไม่ถึงห้อง A-110 (ข้อมูลทดสอบ)", hours: 4, planned_end: null }, created_at: at(-3 * DAY) },
    { action: "system_access.ended", actor_profile_id: personaProfile.systemAdmin, entity_type: "system_read_access", entity_id: sysAccess.id, details_json: { planned_end: at(-3 * DAY + 4 * 60 * 60 * 1000) }, created_at: at(-3 * DAY + 60 * 60 * 1000) },
  ]),
  "system access audit",
);
