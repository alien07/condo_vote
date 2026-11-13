import Link from "next/link";
import { BookOpen, LifeBuoy } from "lucide-react";
import { HelpTopBar, safeFrom, withFrom } from "@/features/help/help-top-bar";
import { HELP_TEXT, listGuides } from "@/lib/help";
import { getLocale } from "@/lib/i18n/server";

// Public: owners who cannot sign in still need the guide.
export default async function HelpIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const from = safeFrom((await searchParams).from);
  const locale = await getLocale();
  const t = HELP_TEXT[locale];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6" lang={locale}>
      <HelpTopBar from={from} locale={locale} />
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LifeBuoy className="text-[var(--primary)]" size={28} />
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-[var(--muted)]">{t.intro}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-3">
        {listGuides(locale).map((guide) => (
          <li key={guide.slug}>
            <Link
              className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--primary)]"
              href={withFrom(`/help/${guide.slug}`, from)}
            >
              <span className="flex items-center gap-2 text-lg font-semibold">
                <BookOpen aria-hidden className="text-[var(--primary)]" size={20} />
                {guide.title}
              </span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                {t.for} {guide.audience}
              </span>
              <span className="mt-2 block text-sm">{guide.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-[var(--muted)]">{t.comingSoon}</p>
      <p className="mt-6">
        <Link className="text-sm font-medium text-[var(--primary)] underline" href="/login">
          {t.signIn}
        </Link>
      </p>
    </main>
  );
}
