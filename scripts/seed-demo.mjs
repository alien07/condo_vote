// Seeds demo data for the local live test (docs/demo-script.md).
//
//   npm run demo:seed               seed into a database without demo data
//   npm run demo:seed -- --reset    `supabase db reset`, then seed (fresh times)
//   npm run demo:seed -- --consent  turn the PDPA consent screen on (local
//                                   supabase/seed.sql turns it off); seeded
//                                   personas have already accepted, so only
//                                   the new user sees it
//
// Local only: refuses to run unless the Supabase URL is localhost / LAN.
// Meeting times are relative to when the script runs, so re-run with --reset
// before each demo. Every demo meeting title starts with "DEMO".
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
// jiti loads the app's TypeScript, so results are built by the same code as
// "Generate result" (features/results/snapshot-payload.ts).
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const tsModule = (file) => jiti.import(pathToFileURL(path.join(root, file)).href);
const { DEMO_PERSONAS, DEMO_SYSTEM_ADMIN } = await tsModule("lib/demo/personas.ts");
const { buildResultPayload } = await tsModule("features/results/snapshot-payload.ts");

// ---------------------------------------------------------------- env

function readEnvFile(file) {
  if (!fs.existsSync(file)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).replace(/^export\s+/, ""),
          line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const fileEnv = readEnvFile(path.join(root, ".env.local"));
const env = (key) => process.env[key] || fileEnv[key];
const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
const anonKey =
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

function fail(message) {
  console.error(`[demo:seed] ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !serviceKey || !anonKey) {
  fail("Missing Supabase URL or keys. Run `npm run supabase:start && npm run env:test`.");
}

const supabaseHost = new URL(supabaseUrl).hostname;

if (!/^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(supabaseHost)) {
  fail(`Refusing to seed a non-local Supabase (${supabaseHost}).`);
}

if (args.has("--reset")) {
  console.log("[demo:seed] supabase db reset ...");
  const reset = spawnSync("npx supabase db reset", { cwd: root, shell: true, stdio: "inherit" });

  if (reset.status !== 0) {
    fail("supabase db reset failed.");
  }
}

const authOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const db = createClient(supabaseUrl, serviceKey, authOptions);

// ---------------------------------------------------------------- helpers

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.now();
const at = (offsetMs) => new Date(NOW + offsetMs).toISOString();
const dateOnly = (offsetMs) => at(offsetMs).slice(0, 10);

async function must(promise, label) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

let knownUsers = null;

async function listAllUsers() {
  const users = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 200) {
      return users;
    }
  }
}

async function ensureAuthUser(email, fullName) {
  knownUsers ??= await listAllUsers();
  const found = knownUsers.find((user) => user.email?.toLowerCase() === email);

  if (found) {
    return found;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    throw new Error(`create user ${email}: ${error.message}`);
  }

  knownUsers.push(data.user);
  return data.user;
}

/** Upserts an approved profile by email; links the auth user when given. */
async function upsertProfile({ email, fullName, defaultStatus, language, authUserId }) {
  const existing = await must(
    db.from("profiles").select("id, full_name").ilike("email", email).limit(1),
    `profile ${email}`,
  );
  const values = {
    email,
    full_name: fullName ?? existing[0]?.full_name ?? email,
    approval_status: "approved",
    default_status: defaultStatus,
    preferred_language: language,
    ...(authUserId ? { auth_user_id: authUserId } : {}),
  };

  if (existing[0]) {
    await must(db.from("profiles").update(values).eq("id", existing[0].id), `profile ${email}`);
    return existing[0].id;
  }

  const created = await must(
    db.from("profiles").insert(values).select("id").single(),
    `profile ${email}`,
  );
  return created.id;
}

async function grantRoles(profileId, roles) {
  if (roles.length > 0) {
    await must(
      db
        .from("app_roles")
        .upsert(roles.map((role) => ({ profile_id: profileId, role })), {
          onConflict: "profile_id,role",
        }),
      "app_roles",
    );
  }
}

/** A client signed in as `email`, for RPCs that check auth.uid(). */
async function sessionFor(email) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });

  if (error) {
    throw new Error(`magic link ${email}: ${error.message}`);
  }

  const client = createClient(supabaseUrl, anonKey, authOptions);
  const verified = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verified.error) {
    throw new Error(`sign in ${email}: ${verified.error.message}`);
  }

  return client;
}

const existingDemo = await must(
  db.from("meetings").select("id").like("title", "DEMO %").limit(1),
  "check existing demo",
);

if (existingDemo.length > 0) {
  fail("Demo data already exists. Run `npm run demo:seed -- --reset` for a fresh copy.");
}

// ---------------------------------------------------------------- people

console.log("[demo:seed] people ...");

const personaProfile = {};
const personaEmail = Object.fromEntries(DEMO_PERSONAS.map((p) => [p.key, p.email]));

for (const persona of DEMO_PERSONAS) {
  if (!persona.seeded) {
    // Fresh each time: the first sign-in creates a pending profile.
    await must(db.from("profiles").delete().ilike("email", persona.email), "new user reset");
    continue;
  }

  const user = await ensureAuthUser(persona.email, persona.fullName);
  personaProfile[persona.key] = await upsertProfile({
    email: persona.email,
    fullName: persona.fullName,
    defaultStatus: persona.defaultStatus,
    language: persona.language,
    authUserId: user.id,
  });
  await grantRoles(personaProfile[persona.key], persona.roles);
}

// The system admin signs in with real Google; Supabase links the Google
// identity to this user by its verified email. A name from an earlier
// Google sign-in is kept.
const sysUser = await ensureAuthUser(DEMO_SYSTEM_ADMIN.email, DEMO_SYSTEM_ADMIN.fullName);
const sysProfile = await upsertProfile({
  email: DEMO_SYSTEM_ADMIN.email,
  defaultStatus: "resident",
  language: "th",
  authUserId: sysUser.id,
});
await grantRoles(sysProfile, [...DEMO_SYSTEM_ADMIN.roles]);

const OWNER_A = personaEmail.ownerA;
const OWNER_B = personaEmail.ownerB;

// 20 rooms, 100% ownership in total: [room, ownership %, owner email].
const ROOMS = [
  ["A-101", 5.5, OWNER_A],
  ["A-102", 4.5, OWNER_A],
  ["A-103", 5.0, "proxy.giver.a103@example.test"],
  ["A-104", 4.0, "voter.a104@example.test"],
  ["A-105", 4.5, "proxy.pending.a105@example.test"],
  ["A-106", 5.0, "proxy.pending.a106@example.test"],
  ["A-107", 4.5, "proxy.limit.a107@example.test"],
  ["A-108", 5.5, "voter.a108@example.test"],
  ["A-109", 4.0, "voter.a109@example.test"],
  ["A-110", 6.0, "voter.a110@example.test"],
  ["A-201", 6.0, OWNER_B],
  ["A-202", 5.0, "voter.a202@example.test"],
  ["A-203", 4.5, "voter.a203@example.test"],
  ["A-204", 5.5, "voter.a204@example.test"],
  ["A-205", 4.0, "voter.a205@example.test"],
  ["A-206", 5.5, "voter.a206@example.test"],
  ["A-207", 4.5, "voter.a207@example.test"],
  ["A-208", 5.0, "voter.a208@example.test"],
  ["A-209", 6.0, "voter.a209@example.test"],
  ["A-210", 5.5, "voter.a210@example.test"],
];
const roomRow = (number) => ROOMS.find(([n]) => n === number);

const OWNER_NAMES = {
  [OWNER_A]: DEMO_PERSONAS.find((p) => p.key === "ownerA").fullName,
  [OWNER_B]: DEMO_PERSONAS.find((p) => p.key === "ownerB").fullName,
  "proxy.giver.a103@example.test": "A-103 · มอบฉันทะให้ Owner A (approved)",
  "proxy.pending.a105@example.test": "A-105 · มอบฉันทะให้ Owner A (pending)",
  "proxy.pending.a106@example.test": "A-106 · มอบฉันทะให้ Owner A (pending)",
  "proxy.limit.a107@example.test": "A-107 · ทดสอบมอบฉันทะเกิน 3 ห้อง",
};
const ENGLISH_OWNERS = new Set([OWNER_B, "voter.a204@example.test"]);

const roomId = {};
const ownerId = {};
const profileByEmail = { [OWNER_A]: personaProfile.ownerA, [OWNER_B]: personaProfile.ownerB };

for (const [number, percent] of ROOMS) {
  const room = await must(
    db
      .from("rooms")
      .upsert(
        {
          room_number: number,
          ownership_percent: percent,
          building: "DEMO-A",
          floor: number.slice(2, 3),
          area_size: 30 + percent * 5,
          active: true,
        },
        { onConflict: "room_number" },
      )
      .select("id")
      .single(),
    `room ${number}`,
  );
  roomId[number] = room.id;
}

async function ensureOwner(email, fullName, phone = null) {
  const found = await must(db.from("owners").select("id").eq("email", email).limit(1), `owner ${email}`);

  if (found[0]) {
    ownerId[email] = found[0].id;
    return;
  }

  const created = await must(
    db.from("owners").insert({ email, full_name: fullName, phone, active: true }).select("id").single(),
    `owner ${email}`,
  );
  ownerId[email] = created.id;
}

for (const [number, , email] of ROOMS) {
  const fullName = OWNER_NAMES[email] ?? `Voter ${number}`;
  await ensureOwner(email, fullName, `0810${number.replace("-", "")}`);

  if (!profileByEmail[email]) {
    // Synthetic voters: approved owner profiles without a sign-in.
    profileByEmail[email] = await upsertProfile({
      email,
      fullName,
      defaultStatus: "owner",
      language: ENGLISH_OWNERS.has(email) ? "en" : "th",
    });
  }
}

// Ownership link states: ended (A-209), scheduled (A-210), cancelled (A-208).
await ensureOwner("seller.ended.a209@example.test", "A-209 · เจ้าของเดิม (ended)");
await ensureOwner("buyer.scheduled.a210@example.test", "A-210 · ผู้ซื้อ (scheduled)");
await ensureOwner("buyer.cancelled.a208@example.test", "A-208 · ผู้ซื้อ (cancelled)");

const links = [];

for (const [number, , email] of ROOMS) {
  if (number === "A-209") {
    links.push({ room: number, owner: "seller.ended.a209@example.test", starts_at: dateOnly(-700 * DAY), ends_at: dateOnly(-40 * DAY), status: "ended" });
    links.push({ room: number, owner: email, starts_at: dateOnly(-39 * DAY), ends_at: null, status: "active" });
  } else if (number === "A-210") {
    links.push({ room: number, owner: email, starts_at: dateOnly(-500 * DAY), ends_at: dateOnly(30 * DAY), status: "active" });
    links.push({ room: number, owner: "buyer.scheduled.a210@example.test", starts_at: dateOnly(31 * DAY), ends_at: null, status: "scheduled" });
  } else if (number === "A-208") {
    links.push({ room: number, owner: email, starts_at: dateOnly(-400 * DAY), ends_at: null, status: "active" });
    links.push({ room: number, owner: "buyer.cancelled.a208@example.test", starts_at: dateOnly(60 * DAY), ends_at: null, status: "cancelled", cancelled_at: at(-2 * DAY), cancelled_by: personaProfile.admin });
  } else {
    links.push({ room: number, owner: email, starts_at: dateOnly(-365 * DAY), ends_at: null, status: "active" });
  }
}

await must(
  db.from("room_owners").insert(
    links.map((link) => ({
      room_id: roomId[link.room],
      owner_id: ownerId[link.owner],
      ownership_role: "owner",
      starts_at: link.starts_at,
      ends_at: link.ends_at,
      status: link.status,
      cancelled_at: link.cancelled_at ?? null,
      cancelled_by: link.cancelled_by ?? null,
    })),
  ),
  "room owners",
);

// Juristic person and committee members for the official record.
const condo = await must(db.from("condo_profiles").select("id").limit(1), "condo");

if (condo.length === 0) {
  await must(
    db.from("condo_profiles").insert({
      project_name: "DEMO Condo (ข้อมูลทดสอบ)",
      juristic_name: "นิติบุคคลอาคารชุด เดโม่ คอนโด",
      registration_no: "DEMO-0001",
      tax_id: "0000000000000",
      address: "99 ถนนทดสอบ แขวงตัวอย่าง เขตเดโม่ กรุงเทพฯ 10000",
      manager_name: "ผู้จัดการ เดโม่",
      email: "juristic@example.test",
    }),
    "condo profile",
  );
}

await must(
  db.from("committee_members").insert([
    { full_name: DEMO_PERSONAS.find((p) => p.key === "committee").fullName, position_title: "ประธานกรรมการ", profile_id: personaProfile.committee, display_order: 1, active: true },
    { full_name: DEMO_SYSTEM_ADMIN.fullName, position_title: "กรรมการ", profile_id: sysProfile, display_order: 2, active: true },
  ]),
  "committee members",
);

// PDPA consent: seeded personas have accepted the current notice. The new
// user has no profile, so it sees the notice when consent is required.
const privacy = await must(db.from("privacy_settings").select("notice_version").single(), "privacy");
await must(
  db.from("profile_consents").insert(
    [...Object.values(personaProfile), sysProfile].map((profileId) => ({
      profile_id: profileId,
      notice_version: privacy.notice_version,
    })),
  ),
  "consents",
);

if (args.has("--consent")) {
  await must(
    db.from("privacy_settings").update({ consent_required: true }).eq("id", true),
    "consent required",
  );
}

// ---------------------------------------------------------------- meetings

const admin = personaProfile.admin;
const ALL_ROOMS = ROOMS.map(([number]) => number);

/** Deterministic pick per room, so results are the same on every run. */
function pick(number, salt, options) {
  let hash = 0;

  for (const ch of `${number}:${salt}`) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }

  return options[hash % options.length];
}

const AGREE_DISAGREE = ["เห็นด้วย", "ไม่เห็นด้วย"];
const STANDARD_QUESTIONS = [
  {
    agenda_no: "1",
    agenda_title: "งบการเงิน",
    question_text: "อนุมัติงบการเงินประจำปี 2568",
    question_type: "single_choice",
    required_threshold: "majority_submitted",
    choices: AGREE_DISAGREE,
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

const PRESETS = {
  majority_submitted: { pass_basis: "voting_ownership", pass_operator: "gt", pass_percent: 50 },
  half_total: { pass_basis: "total_ownership", pass_operator: "gt", pass_percent: 50 },
  three_fourths_total: { pass_basis: "total_ownership", pass_operator: "gte", pass_percent: 75 },
  informational: { pass_basis: "none", pass_operator: "gte", pass_percent: 0 },
};

/** Default answers: mostly the first choice, up to two candidates. */
function defaultAnswers(number, questions) {
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

const choiceFor = (question, choice) =>
  choice === "abstain" ? question.abstainId : question.choiceIds[choice];

const meetingIds = {};

async function createMeeting(spec) {
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
          display_order: index + 1,
          required: true,
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

const votes = (rooms, when, answers) => rooms.map((room) => ({ room, at: when, answers }));

console.log("[demo:seed] meetings ...");

// M1: meeting-day voting open. Owner A: 2 own rooms + A-103 by proxy;
// A-105 and A-106 proxies are pending, so a 4th proxy hits the limit.
await createMeeting({
  key: "M1",
  title: "DEMO M1 · ประชุมใหญ่สามัญ 2569 (เปิดโหวตวันประชุม)",
  meeting_number: "1/2569",
  starts_at: at(-HOUR),
  ends_at: at(3 * DAY),
  status: "published",
  notice_sent_at: at(-15 * DAY),
  proxies: [
    { room: "A-103", status: "approved", document: true },
    { room: "A-105", status: "pending" },
    { room: "A-106", status: "pending" },
  ],
  online: votes(["A-104", "A-108", "A-110", "A-202", "A-204", "A-206", "A-207", "A-209"], at(-30 * MINUTE)),
});

// M2: advance voting window open now; meeting day in 5 days.
await createMeeting({
  key: "M2",
  title: "DEMO M2 · ลงคะแนนล่วงหน้า (เปิดอยู่)",
  starts_at: at(5 * DAY),
  ends_at: at(5 * DAY + 4 * HOUR),
  advance_starts_at: at(-DAY),
  advance_ends_at: at(2 * DAY),
  status: "published",
  notice_sent_at: at(-10 * DAY),
  online: votes(["A-104", "A-202", "A-203"], at(-2 * HOUR)),
});

// M3: between the advance window and the meeting day: closed for now.
await createMeeting({
  key: "M3",
  title: "DEMO M3 · ระหว่างโหวตล่วงหน้ากับวันประชุม (ยังโหวตไม่ได้)",
  starts_at: at(2 * DAY),
  ends_at: at(2 * DAY + 4 * HOUR),
  advance_starts_at: at(-3 * DAY),
  advance_ends_at: at(-DAY),
  status: "published",
  notice_sent_at: at(-14 * DAY),
  online: votes(["A-108", "A-206"], at(-2 * DAY)),
});

// M4: secret ballot, open; Owner A also votes A-103 as proxy.
await createMeeting({
  key: "M4",
  title: "DEMO M4 · ลงคะแนนลับ (เปิดอยู่)",
  meeting_type: "egm",
  starts_at: at(-2 * HOUR),
  ends_at: at(2 * DAY),
  ballot_secrecy: "secret",
  status: "published",
  notice_sent_at: at(-14 * DAY),
  proxies: [{ room: "A-103", status: "approved" }],
  questions: [
    {
      agenda_no: "1",
      agenda_title: "ถอดถอนผู้จัดการ",
      question_text: "เห็นควรถอดถอนผู้จัดการนิติบุคคลหรือไม่ (ลงคะแนนลับ)",
      question_type: "single_choice",
      required_threshold: "half_total",
      choices: AGREE_DISAGREE,
    },
  ],
  online: votes(["A-110", "A-204", "A-208"], at(-HOUR)),
});

// M5: draft with each pass rule type and a land office question.
await createMeeting({
  key: "M5",
  title: "DEMO M5 · ร่างการประชุม (กฎผ่านมติ 4 แบบ)",
  meeting_type: "egm",
  starts_at: at(20 * DAY),
  ends_at: at(20 * DAY + 4 * HOUR),
  status: "draft",
  questions: [
    { agenda_no: "1", agenda_title: "เกินกึ่งหนึ่งของผู้ลงคะแนน", question_text: "อนุมัติแผนซ่อมสระว่ายน้ำ", question_type: "single_choice", required_threshold: "majority_submitted", choices: AGREE_DISAGREE },
    { agenda_no: "2", agenda_title: "เกินกึ่งหนึ่งของทั้งหมด", question_text: "ปรับอัตราค่าส่วนกลาง", question_type: "single_choice", required_threshold: "half_total", choices: AGREE_DISAGREE },
    { agenda_no: "3", agenda_title: "3 ใน 4 ของทั้งหมด", question_text: "แก้ไขข้อบังคับนิติบุคคลอาคารชุด", question_type: "single_choice", required_threshold: "three_fourths_total", land_office: true, legal_note: "ต้องจดทะเบียนต่อสำนักงานที่ดิน", choices: AGREE_DISAGREE },
    { agenda_no: "4", agenda_title: "แจ้งเพื่อทราบ", question_text: "รับทราบรายงานผลการดำเนินงาน", question_type: "single_choice", required_threshold: "informational", choices: ["รับทราบ"] },
  ],
});

// M6: voting ended. Owner B voted online AND on paper (conflict), and
// A-205's paper ballot has an unconfirmed identity. Quorum not met.
await createMeeting({
  key: "M6",
  title: "DEMO M6 · ปิดโหวตแล้ว (ต้องแก้ก่อนออกผล)",
  meeting_type: "egm",
  starts_at: at(-2 * DAY),
  ends_at: at(-DAY),
  status: "closed",
  notice_sent_at: at(-16 * DAY),
  online: [
    ...votes(["A-201"], at(-DAY - 3 * HOUR), (n, qs) => qs.map(() => [0])),
    ...votes(["A-202", "A-109"], at(-DAY - 2 * HOUR)),
  ],
  manual: [
    {
      room: "A-201",
      identity: "linked",
      note: "เจ้าของยื่นบัตรกระดาษที่จุดลงทะเบียนด้วย",
      answers: (n, qs) => qs.map((q) => (q.question_type === "multiple_choice" ? [2, 3] : [1])),
    },
    {
      room: "A-205",
      identity: "pending",
      note: "ลายมือชื่อไม่ชัด",
      identityText: "ลายมือชื่ออ่านไม่ออก ต้องตรวจกับทะเบียนเจ้าของ",
    },
  ],
});

// M7: result generated, 1 of 2 committee approvals.
await createMeeting({
  key: "M7",
  title: "DEMO M7 · ออกผลแล้ว รออนุมัติ (1/2)",
  meeting_type: "egm",
  starts_at: at(-8 * DAY),
  ends_at: at(-7 * DAY),
  status: "closed",
  notice_sent_at: at(-22 * DAY),
  online: votes(
    ["A-101", "A-103", "A-104", "A-106", "A-108", "A-110", "A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-210"],
    at(-7 * DAY - 5 * HOUR),
  ),
});

// M8: published with the full meeting record. Q1 decided; Q2 needs 75% of
// total ownership and is not decided.
await createMeeting({
  key: "M8",
  title: "DEMO M8 · เผยแพร่ผลแล้ว (บันทึกการประชุมครบ)",
  meeting_type: "egm",
  meeting_number: "2/2569",
  starts_at: at(-14 * DAY - 3 * HOUR),
  ends_at: at(-14 * DAY),
  advance_starts_at: at(-17 * DAY),
  advance_ends_at: at(-15 * DAY),
  status: "closed",
  notice_sent_at: at(-30 * DAY),
  identity_method: "เข้าสู่ระบบด้วย Google และเทียบอีเมลกับทะเบียนเจ้าของร่วม",
  recording_reference: "DEMO/recordings/M8.mp4",
  traffic_log_reference: "DEMO/logs/M8-traffic.csv",
  questions: [
    STANDARD_QUESTIONS[0],
    {
      agenda_no: "2",
      agenda_title: "แก้ไขข้อบังคับ",
      question_text: "แก้ไขข้อบังคับเรื่องการเลี้ยงสัตว์",
      question_type: "single_choice",
      required_threshold: "three_fourths_total",
      land_office: true,
      legal_note: "ต้องจดทะเบียนต่อสำนักงานที่ดิน",
      choices: AGREE_DISAGREE,
    },
  ],
  online: [
    ...votes(["A-101", "A-102", "A-104", "A-108"], at(-16 * DAY)),
    ...votes(["A-201", "A-202", "A-203", "A-204", "A-206", "A-207", "A-209", "A-110", "A-105"], at(-14 * DAY - HOUR)),
  ],
  incidents: [
    {
      started_at: at(-14 * DAY - 2 * HOUR),
      ended_at: at(-14 * DAY - 2 * HOUR + 15 * MINUTE),
      description: "ระบบวิดีโอขัดข้องประมาณ 15 นาที",
      action_taken: "สลับไปใช้ลิงก์สำรองและขยายเวลาลงคะแนน 15 นาที",
    },
  ],
});

// M9: reconvened meeting, no quorum required; published.
await createMeeting({
  key: "M9",
  title: "DEMO M9 · ประชุมครั้งที่สอง (ไม่ต้องครบองค์ประชุม)",
  meeting_round: "reconvened",
  quorum_rule: "not_required_second_call",
  required_approvals: 1,
  starts_at: at(-3 * DAY),
  ends_at: at(-2 * DAY),
  status: "closed",
  notice_sent_at: at(-10 * DAY),
  online: votes(["A-104", "A-202", "A-208"], at(-2 * DAY - 2 * HOUR)),
});

// M10: last year's meeting, published and archived.
await createMeeting({
  key: "M10",
  title: "DEMO M10 · ประชุมปีที่แล้ว (เก็บถาวร)",
  required_approvals: 1,
  starts_at: at(-200 * DAY),
  ends_at: at(-199 * DAY),
  status: "closed",
  notice_sent_at: at(-215 * DAY),
  online: votes(
    ["A-101", "A-102", "A-103", "A-104", "A-108", "A-110", "A-201", "A-202", "A-204", "A-206", "A-208", "A-209"],
    at(-199 * DAY - 4 * HOUR),
  ),
});

// ---------------------------------------------------------------- results

console.log("[demo:seed] results ...");

const adminSession = await sessionFor(personaEmail.admin);
const committeeSession = await sessionFor(personaEmail.committee);
const sysSession = await sessionFor(DEMO_SYSTEM_ADMIN.email);

/** Same reads and payload as "Generate result" in the admin app. */
async function generateResult(meetingId) {
  const [meeting, questions, eligible, ballots, manualBallots, resolutions, condoRows, incidents] =
    await Promise.all([
      must(db.from("meetings").select("id, title, starts_at, ends_at, status, meeting_number, meeting_type, fiscal_year, location, chairperson_name, quorum_rule, ballot_secrecy, advance_starts_at, advance_ends_at, notice_sent_at, meeting_round, identity_method, recording_reference, traffic_log_reference").eq("id", meetingId).single(), "meeting"),
      must(db.from("meeting_questions").select("id, agenda_no, agenda_title, question_text, question_type, resolution_type, required_threshold, pass_basis, pass_operator, pass_percent, requires_land_office_registration, legal_note, display_order, meeting_choices(id, choice_text, display_order, is_abstain)").eq("meeting_id", meetingId).order("display_order"), "questions"),
      must(db.from("eligible_voters_snapshot").select("room_id, ownership_percent, voter_type").eq("meeting_id", meetingId), "eligible"),
      must(db.from("ballots").select("id, room_id, status, submitted_at").eq("meeting_id", meetingId).eq("status", "submitted"), "ballots"),
      must(db.from("manual_ballots").select("id, room_id, source_label, audit_note, identity_status, voter_profile_id, voter_identity_text, manual_ballot_answers(question_id, choice_id)").eq("meeting_id", meetingId).eq("status", "submitted").neq("identity_status", "pending"), "manual"),
      must(db.from("vote_source_resolutions").select("room_id, online_ballot_id, manual_ballot_id, chosen_source, chosen_ballot_id, conflict_remark, resolved_at").eq("meeting_id", meetingId), "resolutions"),
      must(db.from("condo_profiles").select("project_name, juristic_name, registration_no, tax_id, address, manager_name").order("created_at", { ascending: false }).limit(1), "condo"),
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

async function approve(session, snapshotId, notes) {
  await must(
    session.rpc("approve_result_snapshot", { p_result_snapshot_id: snapshotId, p_notes: notes }),
    "approve result",
  );
}

// Oldest first: the owner summary page opens on the latest publication, so
// M8 is published last.
const m10 = await generateResult(meetingIds.M10);
await approve(committeeSession, m10, null);

const m9 = await generateResult(meetingIds.M9);
await approve(committeeSession, m9, null);

const m7 = await generateResult(meetingIds.M7);
await approve(committeeSession, m7, "ตรวจแล้วถูกต้อง (คนที่ 1)");

const m8 = await generateResult(meetingIds.M8);
await approve(committeeSession, m8, "ตรวจแล้วถูกต้อง");
await approve(sysSession, m8, "อนุมัติเผยแพร่");

await must(db.from("meetings").update({ status: "archived" }).eq("id", meetingIds.M10), "archive M10");

// ---------------------------------------------------------------- emails, documents

console.log("[demo:seed] emails and documents ...");

const ownerProfiles = await must(
  db.from("profiles").select("email, preferred_language").in("email", ROOMS.map(([, , email]) => email)),
  "owner profiles",
);
const invites = ownerProfiles.map((profile) => {
  const failed = profile.email === "voter.a110@example.test";
  return {
    recipient_email: profile.email,
    template_key: `vote_invitation:${meetingIds.M1}`,
    language: profile.preferred_language,
    status: failed ? "failed" : "sent",
    sent_at: failed ? null : at(-15 * DAY),
    error_message: failed ? "550 Mailbox unavailable (DEMO)" : null,
    provider_message_id: failed ? null : `demo-${profile.email}`,
    created_at: at(-15 * DAY),
  };
});
const queued = ownerProfiles.slice(0, 4).map((profile) => ({
  recipient_email: profile.email,
  template_key: `vote_invitation:${meetingIds.M2}`,
  language: profile.preferred_language,
  status: "queued",
  sent_at: null,
  error_message: null,
  provider_message_id: null,
  // Bulk inserts need the same keys on every row.
  created_at: at(-HOUR),
}));
await must(db.from("email_logs").insert([...invites, ...queued]), "email logs");

await must(
  db.from("documents").insert({
    owner_type: "profile",
    owner_id: personaProfile.ownerB,
    document_type: "owner_verification",
    storage_provider: "local_drive",
    storage_path: "DEMO/owners/A-201-title-deed.pdf",
    original_filename: "A-201-title-deed.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 254120,
    visibility: "private",
    uploaded_by: admin,
  }),
  "owner document",
);

console.log(`[demo:seed] done: ${Object.keys(meetingIds).join(", ")}
  Sign in : http://localhost:3000/login (demo buttons) or Google as ${DEMO_SYSTEM_ADMIN.email}
  PDPA    : ${args.has("--consent") ? "consent screen ON (the new user must accept)" : "consent screen OFF (add --consent for flow F4)"}
  Next    : Admin > Results > M8 > "Create PDF files" (docs/demo-script.md, checkpoint 0)`);
