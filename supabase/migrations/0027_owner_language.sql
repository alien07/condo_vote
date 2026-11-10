-- D020: owner language. Owner-facing pages, emails and the owner summary use
-- each profile's preferred language. Thai is the default.

alter table public.profiles
  add column preferred_language text not null default 'th'
    constraint profiles_preferred_language_check check (preferred_language in ('th', 'en'));

comment on column public.profiles.preferred_language is
  'Language for owner-facing pages, emails and the owner summary (D020).';

-- Users change only their own language; admins already update profiles.
create or replace function public.set_preferred_language(language text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if language not in ('th', 'en') then
    raise exception 'INVALID_LANGUAGE';
  end if;

  update public.profiles
  set preferred_language = language
  where auth_user_id = auth.uid();
end;
$$;

revoke execute on function public.set_preferred_language(text) from public;
grant execute on function public.set_preferred_language(text) to authenticated;

-- Emails record the language they were queued in.
alter table public.email_logs
  add column language text not null default 'th'
    constraint email_logs_language_check check (language in ('th', 'en'));

-- Privacy notice in both languages. notice_text is Thai; notice_text_en is
-- optional and falls back to the Thai text.
alter table public.privacy_settings
  add column notice_text_en text;

create or replace function public.bump_privacy_notice_version()
returns trigger
language plpgsql
as $$
begin
  if new.notice_text is distinct from old.notice_text
     or new.notice_text_en is distinct from old.notice_text_en then
    new.notice_version := old.notice_version + 1;
  else
    new.notice_version := old.notice_version;
  end if;
  new.updated_at := now();
  new.updated_by := public.current_profile_id();
  return new;
end;
$$;

-- The seeded notice was English. Keep it as the English text and add Thai.
update public.privacy_settings
set notice_text_en = notice_text,
    notice_text = $notice$เราเก็บชื่อ อีเมล เบอร์โทรศัพท์ ห้องชุด และข้อมูลการลงคะแนนของท่าน เพื่อจัดการประชุมและการลงมติของอาคารชุด ตรวจสอบสิทธิ์ลงคะแนน และเก็บบันทึกผลการลงมติตามกฎหมาย

ข้อมูลของท่านเปิดเผยเฉพาะต่อนิติบุคคลอาคารชุด คณะกรรมการ และผู้ให้บริการที่ดูแลระบบนี้เท่านั้น ข้อมูลการลงคะแนนจะเก็บไว้ตามระยะเวลาที่ผู้ดูแลระบบกำหนด จากนั้นจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้

ท่านขอดู แก้ไข หรือลบข้อมูลส่วนบุคคลของท่านได้ โดยติดต่อสำนักงานนิติบุคคล ข้อมูลการลงคะแนนบางส่วนต้องเก็บไว้ตามที่กฎหมายกำหนด$notice$
where notice_text like 'We collect your name, email, phone number, room, and voting records%';
