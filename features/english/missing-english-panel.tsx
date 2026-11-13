import Link from "next/link";
import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

/** Admin overview (item 6b): with two-language documents on, meetings that
 * still need English text or a check. Nothing blocks voting. */
export async function MissingEnglishPanel() {
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

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, status, title_en, english_checked_at")
    .neq("status", "archived")
    .or("title_en.is.null,english_checked_at.is.null")
    .order("starts_at", { ascending: true });

  if (!meetings || meetings.length === 0) {
    return null;
  }

  const { s } = await getStaffI18n();
  const t = s.english;

  return (
    <section
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      data-testid="missing-english"
    >
      <h2 className="font-semibold">{t.overviewTitle}</h2>
      <p className="mt-1">{t.overviewText}</p>
      <ul className="mt-2 grid gap-1">
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <Link className="font-medium underline" href={`/admin/meetings/${meeting.id}/english`}>
              {meeting.title}
            </Link>{" "}
            · {!meeting.title_en ? t.missing : t.needsCheck} · {codeLabel(s.common.code, meeting.status)}
          </li>
        ))}
      </ul>
    </section>
  );
}
