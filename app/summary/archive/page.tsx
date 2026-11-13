import Link from "next/link";
import { Archive } from "lucide-react";
import { getSummaryList } from "@/features/summary/data";
import { requireResultsAccess } from "@/lib/auth/access";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDateIn } from "@/lib/i18n/format";
import { getLocale } from "@/lib/i18n/server";

type ArchivePageProps = {
  searchParams: Promise<{ year?: string }>;
};

const NO_YEAR = "none";

// Every published result, grouped by fiscal year (demo feedback item 8): the
// side panel on the summary page shows only the latest few, and older results
// had no link anywhere.
export default async function ResultArchivePage({ searchParams }: ArchivePageProps) {
  await requireResultsAccess();
  const [list, locale, { year }] = await Promise.all([getSummaryList(), getLocale(), searchParams]);
  const t = getDictionary(locale).summary;
  const yearOf = (value: string | null) => value?.trim() || NO_YEAR;
  const years = [...new Set(list.map((item) => yearOf(item.fiscalYear)))];
  const activeYear = year && years.includes(year) ? year : undefined;
  const groups = years
    .filter((value) => !activeYear || value === activeYear)
    .map((value) => ({
      year: value,
      items: list.filter((item) => yearOf(item.fiscalYear) === value),
    }));
  const yearLabel = (value: string) => (value === NO_YEAR ? t.archiveNoYear : t.archiveYear(value));

  return (
    <main className="min-h-screen px-6 py-8" lang={locale}>
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start gap-3 border-b border-[var(--border)] pb-5">
          <Archive className="mt-1 text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">{t.archiveTitle}</h1>
            <p className="text-sm text-[var(--muted)]">{t.archiveIntro}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t.archiveEmpty}</p>
        ) : (
          <div className="grid gap-6">
            {years.length > 1 ? (
              <nav aria-label={t.archiveAllYears} className="flex flex-wrap gap-2 text-sm">
                {[undefined, ...years].map((value) => (
                  <Link
                    aria-current={value === activeYear ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 ${
                      value === activeYear
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                    href={value ? `/summary/archive?year=${encodeURIComponent(value)}` : "/summary/archive"}
                    key={value ?? "all"}
                  >
                    {value ? yearLabel(value) : t.archiveAllYears}
                  </Link>
                ))}
              </nav>
            ) : null}

            {groups.map((group) => (
              <section aria-labelledby={`year-${group.year}`} className="grid gap-2" key={group.year}>
                <h2 className="text-base font-semibold" id={`year-${group.year}`}>
                  {yearLabel(group.year)}
                </h2>
                <ul className="grid gap-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--primary)] sm:flex-row sm:items-center sm:justify-between"
                        href={`/summary/${item.meetingId}`}
                      >
                        <span className="font-medium">{item.title ?? t.approvedResult}</span>
                        <span className="text-[var(--muted)]">
                          {item.meetingStartsAt ? t.meetingOn(formatDateIn(locale, item.meetingStartsAt)) : null}
                          {item.meetingStartsAt ? " · " : null}
                          {t.publishedOn(formatDateIn(locale, item.publishedAt))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <Link className="w-fit text-sm font-medium text-[var(--primary)] underline" href="/summary">
              {t.backToSummary}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
