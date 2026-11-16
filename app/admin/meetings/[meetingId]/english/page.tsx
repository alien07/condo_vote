import Link from "next/link";
import { notFound } from "next/navigation";
import { Languages } from "lucide-react";
import { saveMeetingEnglish } from "@/features/english/actions";
import { getEnglishMeeting } from "@/features/english/data";
import { EnglishEditor } from "@/features/english/english-editor";
import { requireAdmin } from "@/lib/auth/permissions";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { translationProvider } from "@/lib/translation";

type EnglishPageProps = { params: Promise<{ meetingId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// English text of one meeting (D020, demo feedback item 6b).
export default async function MeetingEnglishPage({ params }: EnglishPageProps) {
  await requireAdmin();
  const { meetingId } = await params;

  if (!UUID.test(meetingId)) {
    notFound();
  }

  const [meeting, { locale, s }] = await Promise.all([getEnglishMeeting(meetingId), getStaffI18n()]);

  if (!meeting) {
    notFound();
  }

  const t = s.english;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
        <Languages className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm font-medium">{meeting.title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.intro}</p>
          {meeting.status !== "draft" ? (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t.afterPublish}</p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--muted)]">
            {fill(t.provider, {
              provider: translationProvider() === "azure" ? t.providerAzure : t.providerMock,
            })}
          </p>
        </div>
      </div>

      <EnglishEditor
        action={saveMeetingEnglish}
        checkedLabel={
          meeting.english_checked_at
            ? fill(t.checkedAt, { time: formatDateTimeIn(locale, meeting.english_checked_at) })
            : t.notChecked
        }
        meeting={meeting}
        t={t}
      />

      <Link className="mt-6 inline-block text-sm font-medium text-[var(--primary)] underline" href="/admin/meetings">
        {s.adminHome.nav.meetings}
      </Link>
    </main>
  );
}
