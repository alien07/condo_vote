do $$
begin
  if exists (
    select 1
    from public.room_owners
    where ends_at is null
    group by room_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add single active owner guard: duplicate active room_owners exist. End duplicate active links before applying this migration.';
  end if;
end $$;

create unique index room_owners_one_active_owner_per_room_idx
on public.room_owners(room_id)
where ends_at is null;
