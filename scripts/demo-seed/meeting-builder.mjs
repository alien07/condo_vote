// Meeting builder: questions, presets, default answers, createMeeting().

import { en, db, DAY, at, must, DEMO_PERSONAS } from "./context.mjs";
import {
  personaProfile,
  ROOMS,
  roomRow,
  roomId,
  ownerId,
  profileByEmail,
} from "./people.mjs";

// ---------------------------------------------------------------- meetings

export const admin = personaProfile.admin;
export const ALL_ROOMS = ROOMS.map(([number]) => number);

/** Deterministic pick per room, so results are the same on every run. */
export function pick(number, salt, options) {
  let hash = 0;

  for (const ch of `${number}:${salt}`) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }

  return options[hash % options.length];
}

export const AGREE_DISAGREE = ["เห็นด้วย", "ไม่เห็นด้วย"];
export const STANDARD_QUESTIONS = [
  {
    agenda_no: "1",
    agenda_title: "งบการเงิน",
    question_text: "อนุมัติงบการเงินประจำปี 2568",
    question_type: "single_choice",
    required_threshold: "majority_submitted",
    choices: AGREE_DISAGREE,
    // Voters may add a comment (0040).
    allow_comment: true,
  },
  {
    agenda_no: "2",
    agenda_title: "เลือกตั้งกรรมการ",
    question_text: "เลือกกรรมการ (เลือกได้ไม่เกิน 2 คน)",
    question_type: "multiple_choice",
    max_choices: 2,
    required_threshold: "majority_submitted",
    choices: ["คุณสมชาย", "คุณสมหญิง", "คุณวิชัย", "คุณมาลี"],
  },
];

export const PRESETS = {
  majority_submitted: { pass_basis: "voting_ownership", pass_operator: "gt", pass_percent: 50 },
  half_total: { pass_basis: "total_ownership", pass_operator: "gt", pass_percent: 50 },
  three_fourths_total: { pass_basis: "total_ownership", pass_operator: "gte", pass_percent: 75 },
  informational: { pass_basis: "none", pass_operator: "gte", pass_percent: 0 },
};

/** Default answers: mostly the first choice, up to two candidates. */
export function defaultAnswers(number, questions) {
  return questions.map((question) => {
    if (question.question_type === "multiple_choice") {
      const first = pick(number, "c1", [0, 1, 1, 0, 2]);
      const second = pick(number, "c2", [1, 3, 0, 2, 1]);
      return first === second ? [first] : [first, second];
    }

    if (question.choiceIds.length === 1) {
      return [0];
    }

    return [pick(number, question.agenda_no, [0, 0, 0, 1, 0, 0, "abstain"])];
  });
}

export const choiceFor = (question, choice) =>
  choice === "abstain" ? question.abstainId : question.choiceIds[choice];

export const meetingIds = {};

export async function createMeeting(spec) {
  const meeting = await must(
    db
      .from("meetings")
      .insert({
        title: spec.title,
        starts_at: spec.starts_at,
        ends_at: spec.ends_at,
        advance_starts_at: spec.advance_starts_at ?? null,
        advance_ends_at: spec.advance_ends_at ?? null,
        status: "draft",
        meeting_type: spec.meeting_type ?? "agm",
        meeting_number: spec.meeting_number ?? null,
        fiscal_year: "2569",
        location: "ห้องประชุมชั้น 1 และออนไลน์",
        title_en: en(spec.title),
        location_en: en("ห้องประชุมชั้น 1 และออนไลน์"),
        english_checked_at: new Date().toISOString(),
        chairperson_name: DEMO_PERSONAS.find((p) => p.key === "committee").fullName,
        quorum_rule: spec.quorum_rule ?? "one_fourth_total_ownership",
        ballot_secrecy: spec.ballot_secrecy ?? "open",
        required_approvals: spec.required_approvals ?? 2,
        meeting_round: spec.meeting_round ?? "first",
        notice_sent_at: spec.notice_sent_at ?? null,
        identity_method: spec.identity_method ?? null,
        recording_reference: spec.recording_reference ?? null,
        traffic_log_reference: spec.traffic_log_reference ?? null,
      })
      .select("id")
      .single(),
    spec.title,
  );
  meetingIds[spec.key] = meeting.id;

  // Questions; a database trigger adds the Abstain choice to each.
  const questions = [];

  for (const [index, question] of (spec.questions ?? STANDARD_QUESTIONS).entries()) {
    const row = await must(
      db
        .from("meeting_questions")
        .insert({
          meeting_id: meeting.id,
          agenda_no: question.agenda_no,
          agenda_title: question.agenda_title,
          question_text: question.question_text,
          question_type: question.question_type,
          max_choices: question.max_choices ?? null,
          resolution_type: "ordinary",
          required_threshold: question.required_threshold,
          ...PRESETS[question.required_threshold],
          requires_land_office_registration: question.land_office ?? false,
          legal_note: question.legal_note ?? null,
          agenda_title_en: en(question.agenda_title),
          question_text_en: en(question.question_text),
          legal_note_en: en(question.legal_note),
          display_order: index + 1,
          required: true,
          allow_comment: question.allow_comment ?? false,
        })
        .select("id, question_type, agenda_no")
        .single(),
      `question ${question.agenda_no}`,
    );
    await must(
      db.from("meeting_choices").insert(
        question.choices.map((text, order) => ({
          question_id: row.id,
          choice_text: text,
          choice_text_en: en(text),
          display_order: order + 1,
        })),
      ),
      "choices",
    );
    const choices = await must(
      db.from("meeting_choices").select("id, is_abstain, display_order").eq("question_id", row.id).order("display_order"),
      "choices",
    );
    questions.push({
      ...row,
      choiceIds: choices.filter((choice) => !choice.is_abstain).map((choice) => choice.id),
      abstainId: choices.find((choice) => choice.is_abstain)?.id,
    });
  }

  // Proxies go in while the meeting is a draft; the snapshot is then built
  // like "Publish": the owner's profile per room, an approved proxy wins.
  const proxyRooms = new Set();

  for (const proxy of spec.proxies ?? []) {
    const row = await must(
      db
        .from("proxy_authorizations")
        .insert({
          meeting_id: meeting.id,
          room_id: roomId[proxy.room],
          owner_id: ownerId[roomRow(proxy.room)[2]],
          proxy_profile_id: personaProfile.ownerA,
          status: proxy.status,
          reviewed_at: proxy.status === "approved" ? at(-DAY) : null,
          reviewed_by: proxy.status === "approved" ? admin : null,
        })
        .select("id")
        .single(),
      `proxy ${proxy.room}`,
    );

    if (proxy.status === "approved") {
      proxyRooms.add(proxy.room);
    }

    if (proxy.document) {
      await must(
        db.from("documents").insert({
          owner_type: "proxy_authorization",
          owner_id: row.id,
          document_type: "proxy_authorization",
          storage_provider: "local_drive",
          storage_path: `DEMO/proxies/${spec.key}-${proxy.room}.pdf`,
          original_filename: `proxy-${spec.key}-${proxy.room}.pdf`,
          mime_type: "application/pdf",
          file_size_bytes: 182344,
          visibility: "private",
          uploaded_by: admin,
        }),
        "proxy document",
      );
    }
  }

  const voterByRoom = {};

  if (spec.status !== "draft") {
    await must(
      db.from("eligible_voters_snapshot").insert(
        ALL_ROOMS.map((number) => {
          const [, percent, email] = roomRow(number);
          const isProxy = proxyRooms.has(number);
          voterByRoom[number] = isProxy ? personaProfile.ownerA : profileByEmail[email];
          return {
            meeting_id: meeting.id,
            room_id: roomId[number],
            profile_id: voterByRoom[number],
            voter_type: isProxy ? "proxy" : "owner",
            ownership_percent: percent,
            source: isProxy ? "proxy_authorization" : "owner_master",
          };
        }),
      ),
      "snapshot",
    );
  }

  // Online ballots, written with their real submit times.
  for (const ballotSpec of spec.online ?? []) {
    const answers = (ballotSpec.answers ?? defaultAnswers)(ballotSpec.room, questions);
    const ballot = await must(
      db
        .from("ballots")
        .insert({
          meeting_id: meeting.id,
          room_id: roomId[ballotSpec.room],
          voter_profile_id: voterByRoom[ballotSpec.room],
          status: "submitted",
          submitted_at: ballotSpec.at,
          version_number: 1,
        })
        .select("id")
        .single(),
      `ballot ${ballotSpec.room}`,
    );
    const answerRows = questions.flatMap((question, index) =>
      answers[index].map((choice) => ({
        ballot_id: ballot.id,
        question_id: question.id,
        choice_id: choiceFor(question, choice),
      })),
    );
    await must(db.from("ballot_answers").insert(answerRows), "ballot answers");
    await must(
      db.from("ballot_versions").insert({
        ballot_id: ballot.id,
        version_number: 1,
        payload_json: {
          meeting_id: meeting.id,
          room_id: roomId[ballotSpec.room],
          submitted_at: ballotSpec.at,
          answers: answerRows.map(({ question_id, choice_id }) => ({ question_id, choice_id })),
        },
      }),
      "ballot version",
    );
  }

  // Paper ballots keyed in by the admin.
  for (const paper of spec.manual ?? []) {
    const answers = (paper.answers ?? defaultAnswers)(paper.room, questions);
    const manual = await must(
      db
        .from("manual_ballots")
        .insert({
          meeting_id: meeting.id,
          room_id: roomId[paper.room],
          status: "submitted",
          source_label: "บัตรกระดาษ จุดลงทะเบียน",
          audit_note: paper.note,
          identity_status: paper.identity,
          voter_profile_id: paper.identity === "linked" ? voterByRoom[paper.room] : null,
          voter_identity_text: paper.identityText ?? null,
          imported_by: admin,
        })
        .select("id")
        .single(),
      `manual ${paper.room}`,
    );
    await must(
      db.from("manual_ballot_answers").insert(
        questions.flatMap((question, index) =>
          answers[index].map((choice) => ({
            manual_ballot_id: manual.id,
            question_id: question.id,
            choice_id: choiceFor(question, choice),
          })),
        ),
      ),
      "manual answers",
    );
  }

  for (const incident of spec.incidents ?? []) {
    await must(
      db.from("meeting_incidents").insert({ meeting_id: meeting.id, created_by: admin, ...incident }),
      "incident",
    );
  }

  if (spec.status !== "draft") {
    await must(
      db
        .from("meetings")
        .update({
          status: spec.status,
          published_at: spec.notice_sent_at ?? at(-7 * DAY),
          closed_at: spec.status === "closed" ? spec.ends_at : null,
        })
        .eq("id", meeting.id),
      "meeting status",
    );
  }
}

export const votes = (rooms, when, answers) => rooms.map((room) => ({ room, at: when, answers }));
