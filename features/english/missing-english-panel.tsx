import Link from "next/link";
import { getStaffI18n } from "@/lib/i18n/server";
import { codeLabel, fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

// Rows shown before "Show N more"; a long list must not push the rest of
// the admin overview down the page (2026-11-18).
const SHOWN = 5;

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
  // Meetings people vote on come first: open, then drafts, then closed.
  const order: Record<string, number> = { published: 0, draft: 1, closed: 2 };
  const sorted = [...meetings].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const shown = sorted.slice(0, SHOWN);
  const rest = sorted.slice(SHOWN);
  const item = (meeting: (typeof meetings)[number]) => (
    <li className="[overflow-wrap:anywhere]" key={meeting.id}>
      <Link className="font-medium underline" href={`/admin/meetings/${meeting.id}/english`}>
        {meeting.title}
      </Link>{" "}
      · {!meeting.title_en ? t.missing : t.needsCheck} · {codeLabel(s.common.code, meeting.status)}
    </li>
  );

  return (
    <section
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      data-testid="missing-english"
    >
      <h2 className="font-semibold">{fill(t.overviewTitle, { count: meetings.length })}</h2>
      <p className="mt-1">{t.overviewText}</p>
      <ul className="mt-2 grid gap-1">{shown.map(item)}</ul>
      {rest.length > 0 ? (
        <details className="mt-2" data-missing-english-more>
          <summary className="tap-target inline-flex min-h-11 cursor-pointer items-center font-medium underline">
            {fill(t.overviewMore, { count: rest.length })}
          </summary>
          <ul className="mt-1 grid max-h-96 gap-1 overflow-y-auto pr-1">{rest.map(item)}</ul>
        </details>
      ) : null}
    </section>
  );
}
