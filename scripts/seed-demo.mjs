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
//
// The steps live in scripts/demo-seed/, one file per feature. Each file
// imports the one before it, so they run in this order.
import "./demo-seed/emails.mjs";
