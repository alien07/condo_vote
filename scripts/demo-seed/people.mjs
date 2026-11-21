// People, rooms, owners, ownership links, juristic person, committee, PDPA
// consent (req_0010: personas by role, docs/demo-script.md).

import {
  args,
  en,
  db,
  DAY,
  at,
  dateOnly,
  must,
  ensureAuthUser,
  upsertProfile,
  grantRoles,
  DEMO_PERSONAS,
  DEMO_SYSTEM_ADMIN,
  env,
} from "./context.mjs";

// ---------------------------------------------------------------- people

console.log("[demo:seed] people ...");

export const personaProfile = {};
export const personaEmail = Object.fromEntries(DEMO_PERSONAS.map((p) => [p.key, p.email]));
export const persona = (key) => DEMO_PERSONAS.find((p) => p.key === key);

for (const p of DEMO_PERSONAS) {
  if (!p.seeded) {
    // Fresh each time: the first sign-in creates a pending profile.
    await must(db.from("profiles").delete().ilike("email", p.email), "new user reset");
    continue;
  }

  const user = await ensureAuthUser(p.email, p.fullName);
  personaProfile[p.key] = await upsertProfile({
    email: p.email,
    fullName: p.fullName,
    defaultStatus: p.defaultStatus,
    language: p.language,
    authUserId: user.id,
  });
  await grantRoles(personaProfile[p.key], p.roles);
}

// The real Google System Admin: system_admin only, no building roles (D027 B).
// Supabase links the Google identity to this user by its verified email. The
// email comes from .env.local (personal data stays out of the repository);
// without it the seed skips this account.
export const googleAdminEmail = env(DEMO_SYSTEM_ADMIN.envKey)?.trim().toLowerCase() || null;
export let sysProfile = null;

if (googleAdminEmail) {
  const sysUser = await ensureAuthUser(googleAdminEmail, DEMO_SYSTEM_ADMIN.fullName);
  sysProfile = await upsertProfile({
    email: googleAdminEmail,
    defaultStatus: "proxy",
    language: "th",
    authUserId: sysUser.id,
  });
  await grantRoles(sysProfile, [...DEMO_SYSTEM_ADMIN.roles]);
}

// Two more committee members without a picker entry, so the committee has 5
// (majority 3 of 5, D027). They sign in only through the seed.
export const EXTRA_MEMBERS = [
  { key: "member4", email: "member.four@example.test", fullName: "คุณสุนทร กรรมการ", room: "A-203" },
  { key: "member5", email: "member.five@example.test", fullName: "คุณกมล กรรมการ", room: "A-205" },
];

for (const member of EXTRA_MEMBERS) {
  const user = await ensureAuthUser(member.email, member.fullName);
  personaProfile[member.key] = await upsertProfile({
    email: member.email,
    fullName: member.fullName,
    defaultStatus: "owner",
    language: "th",
    authUserId: user.id,
  });
  await grantRoles(personaProfile[member.key], ["committee"]);
}

// 20 rooms, 100% ownership in total: [room, ownership %, owner email].
// Personas own their rooms; the other owners are synthetic voters.
export const ROOMS = [
  ["A-101", 5.5, personaEmail.ownerTh],
  ["A-102", 4.5, personaEmail.ownerTh],
  ["A-103", 5.0, "proxy.giver.a103@example.test"],
  ["A-104", 4.0, personaEmail.chair],
  ["A-105", 4.5, "proxy.pending.a105@example.test"],
  ["A-106", 5.0, "proxy.pending.a106@example.test"],
  ["A-107", 4.5, "proxy.external.a107@example.test"],
  ["A-108", 5.5, personaEmail.viceChair],
  ["A-109", 4.0, "voter.a109@example.test"],
  ["A-110", 6.0, personaEmail.ownerCo],
  ["A-201", 6.0, personaEmail.ownerEn],
  ["A-202", 5.0, personaEmail.member],
  ["A-203", 4.5, "member.four@example.test"],
  ["A-204", 5.5, "voter.a204@example.test"],
  ["A-205", 4.0, "member.five@example.test"],
  ["A-206", 5.5, "voter.a206@example.test"],
  ["A-207", 4.5, "voter.a207@example.test"],
  ["A-208", 5.0, "voter.a208@example.test"],
  ["A-209", 6.0, "voter.a209@example.test"],
  ["A-210", 5.5, "voter.a210@example.test"],
];
export const roomRow = (number) => ROOMS.find(([n]) => n === number);

// Names of synthetic owners: what each one is for.
export const OWNER_NAMES = {
  "proxy.giver.a103@example.test": "คุณปรีชา (A-103 มอบฉันทะให้คุณอนันต์)",
  "proxy.pending.a105@example.test": "คุณพิมพ์ (A-105 มอบฉันทะ รออนุมัติ)",
  "proxy.pending.a106@example.test": "คุณภูมิ (A-106 มอบฉันทะ รออนุมัติ)",
  "proxy.external.a107@example.test": "คุณเอก (A-107 มอบฉันทะให้ Peter Proxy)",
};
export const ENGLISH_OWNERS = new Set([personaEmail.ownerEn, personaEmail.member, "voter.a204@example.test"]);

export const roomId = {};
export const ownerId = {};
export const profileByEmail = {};

for (const p of DEMO_PERSONAS) {
  if (personaProfile[p.key]) {
    profileByEmail[p.email] = personaProfile[p.key];
  }
}

for (const member of EXTRA_MEMBERS) {
  profileByEmail[member.email] = personaProfile[member.key];
}

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

export async function ensureOwner(email, fullName, phone = null) {
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

const nameOf = (email, number) =>
  DEMO_PERSONAS.find((p) => p.email === email)?.fullName ??
  EXTRA_MEMBERS.find((m) => m.email === email)?.fullName ??
  OWNER_NAMES[email] ??
  `เจ้าของห้อง ${number}`;

for (const [number, , email] of ROOMS) {
  const fullName = nameOf(email, number);
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

// Owner records link to their accounts (D024), so owners see their rooms.
for (const [, , email] of ROOMS) {
  await must(
    db.from("owners").update({ profile_id: profileByEmail[email] }).eq("id", ownerId[email]).is("profile_id", null),
    `owner link ${email}`,
  );
}

// Ownership link states: ended (A-209), scheduled (A-210), cancelled (A-208).
await ensureOwner("seller.ended.a209@example.test", "เจ้าของเดิม A-209 (สิ้นสุดแล้ว)");
await ensureOwner("buyer.scheduled.a210@example.test", "ผู้ซื้อ A-210 (เริ่มในอนาคต)");
await ensureOwner("buyer.cancelled.a208@example.test", "ผู้ซื้อ A-208 (ยกเลิก)");

export const links = [];

for (const [number, , email] of ROOMS) {
  if (number === "A-209") {
    links.push({ room: number, owner: "seller.ended.a209@example.test", starts_at: dateOnly(-700 * DAY), ends_at: dateOnly(-40 * DAY), status: "ended" });
    links.push({ room: number, owner: email, starts_at: dateOnly(-39 * DAY), ends_at: null, status: "active" });
  } else if (number === "A-210") {
    links.push({ room: number, owner: email, starts_at: dateOnly(-500 * DAY), ends_at: dateOnly(30 * DAY), status: "active" });
    links.push({ room: number, owner: "buyer.scheduled.a210@example.test", starts_at: dateOnly(31 * DAY), ends_at: null, status: "scheduled" });
  } else if (number === "A-208") {
    links.push({ room: number, owner: email, starts_at: dateOnly(-400 * DAY), ends_at: null, status: "active" });
    links.push({ room: number, owner: "buyer.cancelled.a208@example.test", starts_at: dateOnly(60 * DAY), ends_at: null, status: "cancelled", cancelled_at: at(-2 * DAY), cancelled_by: personaProfile.manager });
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

// Juristic person: two-language documents on, so English pages show English.
export const condo = await must(db.from("condo_profiles").select("id").limit(1), "condo");

if (condo.length === 0) {
  await must(
    db.from("condo_profiles").insert({
      project_name: "DEMO Condo (ข้อมูลทดสอบ)",
      juristic_name: "นิติบุคคลอาคารชุด เดโม่ คอนโด",
      project_name_en: en("DEMO Condo (ข้อมูลทดสอบ)"),
      juristic_name_en: en("นิติบุคคลอาคารชุด เดโม่ คอนโด"),
      bilingual_documents: true,
      registration_no: "DEMO-0001",
      tax_id: "0000000000000",
      address: "99 ถนนทดสอบ แขวงตัวอย่าง เขตเดโม่ กรุงเทพฯ 10000",
      manager_name: persona("manager").fullName,
      email: "juristic@example.test",
    }),
    "condo profile",
  );
}

// Committee of 5 (D026 positions, D027 majority 3 of 5).
export const COMMITTEE = [
  { key: "chair", position_code: "chair" },
  { key: "viceChair", position_code: "vice_chair" },
  { key: "member", position_code: "member" },
  { key: "member4", position_code: "member" },
  { key: "member5", position_code: "member" },
];

await must(
  db.from("committee_members").insert(
    COMMITTEE.map((member, index) => ({
      full_name: persona(member.key)?.fullName ?? EXTRA_MEMBERS.find((m) => m.key === member.key).fullName,
      position_code: member.position_code,
      profile_id: personaProfile[member.key],
      display_order: index + 1,
      term_starts_at: dateOnly(-200 * DAY),
      term_ends_at: dateOnly(530 * DAY),
      active: true,
    })),
  ),
  "committee members",
);

// PDPA consent: seeded people have accepted the current notice. The new
// user has no profile, so it sees the notice when consent is required.
export const privacy = await must(db.from("privacy_settings").select("notice_version").single(), "privacy");
await must(
  db.from("profile_consents").insert(
    [...new Set([...Object.values(personaProfile), sysProfile].filter(Boolean))].map((profileId) => ({
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
