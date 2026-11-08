## What And Why
<!-- What changes, and why. Link the issue: Closes #123 -->

## How It Was Tested
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Other checks for the re-test tags below:

Re-test tags: <!-- e.g. @test:voting @test:db -->

## Screenshots
<!-- For UI changes. Use synthetic data only. -->

## Database
- [ ] No schema change
- [ ] New migration added (never edit merged migrations)
- [ ] `npm run types:supabase` run and generated types committed

## Rollback Plan
<!-- How to undo this change if it causes problems. -->

## Review Checklist
- [ ] RLS and permissions: users only see and change what they should
- [ ] Personal data: no real resident data, logs and errors mask personal data
- [ ] Audit: business actions write audit log entries
- [ ] Results: quorum, threshold, and weighting changes have unit tests
- [ ] Docs and decisions updated when behavior, schema, or rules change
- [ ] Not deploying into an open voting window
