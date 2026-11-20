-- Internal helpers are not callable through the API (0047, req_0011).
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

select ok(not has_function_privilege(r, f, 'execute'), format('%s cannot execute %s', r, f))
from unnest(array[
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
  'public.vote_normalize_answers(uuid, jsonb)',
  'public.close_expired_system_access()',
  'public.profile_member_access(uuid)'
]) f, unnest(array['anon', 'authenticated']) r;

-- The API functions stay callable when signed in.
select ok(has_function_privilege('authenticated', 'public.approve_result_snapshot(uuid, text)', 'execute'),
  'authenticated still approves results');
select ok(has_function_privilege('authenticated', 'public.cast_committee_deciding_vote(text, uuid, text, text)', 'execute'),
  'authenticated still casts a deciding vote');
select * from finish();
rollback;
