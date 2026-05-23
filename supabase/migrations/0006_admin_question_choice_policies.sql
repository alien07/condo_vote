-- Admin question and choice policies for meeting ballot setup.

create policy "meeting_questions_admin_select"
on public.meeting_questions
for select
to authenticated
using (public.has_app_role('admin'));

create policy "meeting_questions_admin_insert"
on public.meeting_questions
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "meeting_questions_admin_update"
on public.meeting_questions
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "meeting_questions_admin_delete"
on public.meeting_questions
for delete
to authenticated
using (public.has_app_role('admin'));

create policy "meeting_choices_admin_select"
on public.meeting_choices
for select
to authenticated
using (public.has_app_role('admin'));

create policy "meeting_choices_admin_insert"
on public.meeting_choices
for insert
to authenticated
with check (public.has_app_role('admin'));

create policy "meeting_choices_admin_update"
on public.meeting_choices
for update
to authenticated
using (public.has_app_role('admin'))
with check (public.has_app_role('admin'));

create policy "meeting_choices_admin_delete"
on public.meeting_choices
for delete
to authenticated
using (public.has_app_role('admin'));
