# Compliance

Legal and privacy requirements for running a real meeting with condoVotes.
Legal points here still need lawyer confirmation unless marked otherwise.

## Electronic Meeting Decree (2020)
Decision: [D018](decisions.md#d018---electronic-meeting-compliance-in-v1).
In V1 these steps are done manually by the meeting organizer, outside the
system.

Checklist for each meeting:
- [ ] Confirm the identity of every attendee before the meeting starts.
  Google login identifies the voter in the app; keep the attendee list.
- [ ] Record the meeting audio or video on the external platform
  (YouTube unlisted, Google Meet, Zoom). Store the recording privately.
- [ ] Keep electronic evidence: meeting invitation, attendee list, recording
  link, approved result snapshot, and the PDF summary.
- [ ] Store the evidence in the private document registry
  (Admin > Documents) with a SHA-256 checksum.
- [ ] Note who kept the evidence and where, in the meeting minutes.

## Condominium Act
- One proxy can hold at most three rooms per meeting, section 47
  ([D012](decisions.md#d012---proxy-limit)).
- Pass rules are set per question by admin
  ([D013](decisions.md#d013---configurable-pass-thresholds)). Presets for
  sections 48 and 49 need lawyer confirmation before use.

## Personal Data (PDPA)
Decision: [D016](decisions.md#d016---system-admin-role-and-pdpa-settings).
- Collect consent at registration, with the privacy notice shown.
- System admin configures the privacy notice text and retention periods.
- Retention periods to configure: profiles, ballots and ballot versions,
  proxy and ownership documents, audit logs, email logs.
- Data subject requests (access, correction, deletion) go to the juristic
  person office. Ballot history is immutable for audit; record any
  exception in the audit log.
- See [security-privacy.md](security-privacy.md) for handling rules.
