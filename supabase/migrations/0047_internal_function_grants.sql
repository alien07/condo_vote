-- Internal helpers are not part of the API (req_0011, found while adding
-- 0046). Earlier migrations meant them to be internal with
-- `revoke all ... from public`, but Supabase's default privileges grant
-- EXECUTE on every new function in `public` to anon and authenticated
-- directly, so that revoke did nothing: anyone, signed in or not, could call
-- e.g. publish_result_if_ready through /rest/v1/rpc and publish a result
-- without approvals. These run only inside other security definer functions
-- (as their owner), so taking EXECUTE away from the API roles changes no
-- feature. service_role keeps it (scripts).
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.publish_result_if_ready(uuid, uuid)',
    'public.queue_result_approved_emails(uuid)',
    'public.queue_staff_email(uuid, text)',
    'public.queue_review_again_emails()',
    'public.evaluate_close_request(uuid)',
    'public.notify_result_not_passed(uuid, uuid)',
    'public.committee_tally(text, uuid)',
    'public.committee_chair()',
    'public.committee_member_count()',
    'public.committee_majority(integer)',
    'public.result_has_high_correction(uuid)',
    'public.result_required_approvals(uuid)',
    'public.active_committee_profile_ids()',
    'public.committee_people(uuid[])',
    'public.committee_person_name(uuid)',
    'public.try_link_owner_profile(uuid, uuid, uuid, text)',
    'public.room_owner_profile_id(uuid)',
    'public.profile_has_consent(uuid)',
    'public.vote_normalize_answers(uuid, jsonb)'
  ]::regprocedure[]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Not changed: the default privileges. Revoking PUBLIC's EXECUTE by
-- default also hits pg_temp helpers in the database tests, and calling a
-- pg_temp function without EXECUTE crashes this Postgres image (17.6,
-- signal 11). Rule instead (docs/security-privacy.md): a new internal
-- function revokes from public, anon, authenticated; function_grants.test.sql
-- checks the list.
