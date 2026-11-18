import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

type MeetingLike = {
  english_checked_at?: string | null;
  id: string;
  status: string;
  title: string;
  title_en?: string | null;
};

/**
 * After a meeting or an agenda item is saved with two-language documents
 * on, offers the English page as the next step (2026-11-18, option ก).
 * `always`: show even when the meeting title already has English (an agenda
 * item was saved, and its English is on the same page).
 */
export async function EnglishNextStep({
  always = false,
  meeting,
}: {
  always?: boolean;
  meeting?: MeetingLike;
}) {
  if (!meeting || meeting.status === "archived") {
    return null;
  }

  if (!always && meeting.title_en && meeting.english_checked_at) {
    return null;
  }

  const supabase = await createClient();
  const { data: condo } = await supabase
    .from("condo_profiles")
    .select("bilingual_documents")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!condo?.bilingual_documents) {
    return null;
  }

  const { s } = await getStaffI18n();
  const t = s.english;

  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      data-english-next-step
    >
      <p className="min-w-0 [overflow-wrap:anywhere]">
        <span className="font-semibold">{t.nextStepTitle}</span>{" "}
        {fill(t.nextStepText, { title: meeting.title })}
      </p>
      <a
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)]"
        href={`/admin/meetings/${meeting.id}/english`}
      >
        {t.nextStepButton}
      </a>
    </div>
  );
}
