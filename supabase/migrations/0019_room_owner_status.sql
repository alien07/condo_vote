alter table public.room_owners
add column status text not null default 'active',
add column cancelled_at timestamptz,
add column cancelled_by uuid references public.profiles(id);

alter table public.room_owners
add constraint room_owners_status_check
check (status in ('active', 'scheduled', 'ended', 'cancelled'));

update public.room_owners
set status = case
  when ends_at is not null and ends_at < current_date then 'ended'
  when starts_at is not null and starts_at > current_date then 'scheduled'
  else 'active'
end
where status = 'active';

drop index if exists room_owners_one_active_owner_per_room_idx;

create unique index room_owners_one_open_owner_per_room_idx
on public.room_owners(room_id)
where ends_at is null and status <> 'cancelled';

create index room_owners_status_idx
on public.room_owners(status);
