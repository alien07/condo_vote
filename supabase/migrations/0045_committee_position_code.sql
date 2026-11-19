-- Committee positions are fixed values (D026, user decision 2026-11-19).
-- position_code holds one of seven built-in positions; position_title keeps
-- the typed title only when the code is 'other'. Pages show the label in the
-- page language; documents follow the bilingual document rules (Thai first).

alter table public.committee_members
  add column position_code text not null default 'member';

alter table public.committee_members
  alter column position_title drop not null;

-- Backfill: titles that name a built-in position in Thai or English get its
-- code and lose the typed title; anything else becomes 'other' and keeps it.
-- A function, so the mapping is tested (supabase/tests/committee_position.test.sql).
create or replace function public.committee_position_code_for(p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'))
      when 'chair' then 'chair'
      when 'chairperson' then 'chair'
      when 'chairman' then 'chair'
      when 'committee chair' then 'chair'
      when 'ประธาน' then 'chair'
      when 'ประธานกรรมการ' then 'chair'
      when 'ประธานคณะกรรมการ' then 'chair'
      when 'vice chair' then 'vice_chair'
      when 'vice-chair' then 'vice_chair'
      when 'vice chairperson' then 'vice_chair'
      when 'vice chairman' then 'vice_chair'
      when 'รองประธาน' then 'vice_chair'
      when 'รองประธานกรรมการ' then 'vice_chair'
      when 'secretary' then 'secretary'
      when 'เลขานุการ' then 'secretary'
      when 'เลขานุการคณะกรรมการ' then 'secretary'
      when 'assistant secretary' then 'assistant_secretary'
      when 'ผู้ช่วยเลขานุการ' then 'assistant_secretary'
      when 'treasurer' then 'treasurer'
      when 'เหรัญญิก' then 'treasurer'
      when 'member' then 'member'
      when 'committee member' then 'member'
      when 'กรรมการ' then 'member'
      when '' then 'member'
      else 'other'
    end;
$$;

update public.committee_members
set position_code = public.committee_position_code_for(position_title);

update public.committee_members
set position_title = null
where position_code <> 'other';

alter table public.committee_members
  add constraint committee_members_position_code_check check (
    position_code in (
      'chair', 'vice_chair', 'secretary', 'assistant_secretary',
      'treasurer', 'member', 'other'
    )
  ),
  -- 'other' needs its typed title; a built-in position has none.
  add constraint committee_members_position_title_check check (
    case
      when position_code = 'other' then nullif(btrim(coalesce(position_title, '')), '') is not null
      else position_title is null
    end
  );

comment on column public.committee_members.position_code is
  'Built-in committee position (D026): chair, vice_chair, secretary, assistant_secretary, treasurer, member, other.';
comment on column public.committee_members.position_title is
  'Typed position title, only when position_code is other (D026).';

-- The position label for documents: Thai by default, English with p_lang 'en'.
create or replace function public.committee_position_label(
  p_code text,
  p_title text,
  p_lang text default 'th'
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_code = 'other' or p_code is null then p_title
    when p_lang = 'en' then case p_code
      when 'chair' then 'Chairperson'
      when 'vice_chair' then 'Vice chairperson'
      when 'secretary' then 'Secretary'
      when 'assistant_secretary' then 'Assistant secretary'
      when 'treasurer' then 'Treasurer'
      when 'member' then 'Committee member'
      else p_title
    end
    else case p_code
      when 'chair' then 'ประธานกรรมการ'
      when 'vice_chair' then 'รองประธานกรรมการ'
      when 'secretary' then 'เลขานุการ'
      when 'assistant_secretary' then 'ผู้ช่วยเลขานุการ'
      when 'treasurer' then 'เหรัญญิก'
      when 'member' then 'กรรมการ'
      else p_title
    end
  end;
$$;

-- Committee people for the committee pages: 'position_code' and the typed
-- title let the page show the label in its language; 'position' stays the
-- Thai label for anything that reads it as text.
create or replace function public.committee_people(p_profile_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', p.id,
    'name', coalesce(cm.full_name, p.full_name),
    'position', public.committee_position_label(cm.position_code, cm.position_title),
    'position_code', cm.position_code,
    'position_title', cm.position_title
  ) order by cm.display_order nulls last, p.full_name), '[]'::jsonb)
  from public.profiles p
  left join lateral (
    select full_name, position_code, position_title, display_order
    from public.committee_members c
    where c.profile_id = p.id and c.active
    order by c.display_order
    limit 1
  ) cm on true
  where p.id = any(p_profile_ids);
$$;

revoke all on function public.committee_people(uuid[]) from public;
