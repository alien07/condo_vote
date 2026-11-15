// Email log and document examples, then the summary line.
import "./results.mjs"; // runs after the previous step

import { args, db, HOUR, DAY, at, must, DEMO_SYSTEM_ADMIN } from "./context.mjs";
import { personaProfile, ROOMS } from "./people.mjs";
import { admin, meetingIds } from "./meeting-builder.mjs";

// ---------------------------------------------------------------- emails, documents

console.log("[demo:seed] emails and documents ...");

export const ownerProfiles = await must(
  db.from("profiles").select("email, preferred_language").in("email", ROOMS.map(([, , email]) => email)),
  "owner profiles",
);
export const invites = ownerProfiles.map((profile) => {
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
export const queued = ownerProfiles.slice(0, 4).map((profile) => ({
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
