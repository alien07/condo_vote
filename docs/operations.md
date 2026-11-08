# Operations

## Before First Production Deploy
- [ ] Use a paid Supabase plan (Pro) for production. The free tier can pause
  inactive projects and has no point-in-time recovery.
- [ ] Separate Supabase projects for development and production.
- [ ] Production secrets only in the hosting provider, never in git.
- [ ] Google SMTP account and its daily send limit confirmed (P002).
- [ ] Backup plan: export ballots, ballot versions, and result snapshots
  before and after every meeting, and store them outside Supabase.
- [ ] Uptime check on the production URL during voting windows.
- [ ] No deploy during an open voting window
  ([development-workflow.md](development-workflow.md#voting-system-rules)).

## Runbook: System Down During Voting
Use the existing manual vote import as the fallback channel.

1. **Decide.** If the system is down for more than 15 minutes during the
   voting window, the meeting chair and admin switch to paper or
   phone-collected ballots.
2. **Announce.** Tell voters how to submit, for example a paper ballot at the
   juristic office or a signed form by email, and the deadline.
3. **Collect.** Keep every paper ballot or signed form as evidence.
4. **Import.** When the system is back, admin enters each ballot from
   Admin > Voting > Import manual vote, with an audit note naming the
   fallback channel.
5. **Resolve conflicts.** Rooms that also voted online appear in
   Admin > Voting > Manual/Online Conflicts. Choose one source per room
   with a remark.
6. **Record.** Write the outage times, decision, and channel in the meeting
   minutes and register the evidence in Admin > Documents.

Extending the voting window instead of switching to manual ballots needs
committee approval and must be audited.
