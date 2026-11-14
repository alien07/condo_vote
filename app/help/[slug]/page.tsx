import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Download, Lightbulb } from "lucide-react";
import { HelpNav, HelpTopBar, safeFrom, withFrom } from "@/features/help/help-top-bar";
import { ScreenshotZoom } from "@/features/help/screenshot-zoom";
import { findGuide, HELP_CHECKED_FOR, HELP_TEXT } from "@/lib/help";
import { getHelpReaderRoles } from "@/lib/help/reader";
import type { HelpGuide } from "@/lib/help/types";
import type { Locale } from "@/lib/i18n/locales";
import { getLocale } from "@/lib/i18n/server";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string; from?: string }>;
};

// Screenshots are phone-sized: 390 x 844 CSS pixels (help:screenshots).
const SHOT = { width: 390, height: 844 };

function screenshot(locale: Locale, name: string) {
  return `/help/${locale}/${name}.png`;
}

// Public guide page. `?print=1` is the compact layout that
// `npm run help:pdf` turns into the quick guide PDF.
export default async function HelpGuidePage({ params, searchParams }: GuidePageProps) {
  const [{ slug }, { print, from }] = await Promise.all([params, searchParams]);
  const [locale, roles] = await Promise.all([getLocale(), getHelpReaderRoles()]);
  const guide = findGuide(slug, locale, roles);

  if (!guide) {
    notFound();
  }

  // A guide for other roles: back to the list of guides this reader has.
  if (guide === "forbidden") {
    redirect(withFrom("/help", safeFrom(from)));
  }

  return print ? (
    <PrintGuide guide={guide} locale={locale} />
  ) : (
    <WebGuide from={safeFrom(from)} guide={guide} locale={locale} />
  );
}

function WebGuide({
  from,
  guide,
  locale,
}: {
  from: string | null;
  guide: HelpGuide;
  locale: Locale;
}) {
  const t = HELP_TEXT[locale];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6" lang={locale}>
      <HelpTopBar from={from} locale={locale} showAllGuides />
      <h1 className="text-2xl font-semibold">{guide.title}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {t.for} {guide.audience}
      </p>
      <p className="mt-3">{guide.summary}</p>
      <a
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium"
        download
        href={`/help/${guide.slug}-quick-guide-${locale}.pdf`}
      >
        <Download aria-hidden size={16} />
        {t.pdf}
      </a>

      <nav aria-label={t.steps} className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-semibold">{t.steps}</h2>
        <ol className="mt-2 grid gap-1 text-sm">
          {guide.steps.map((step, index) => (
            <li key={step.id}>
              <a className="text-[var(--primary)] underline" href={`#${step.id}`}>
                {index + 1}. {step.title}
              </a>
            </li>
          ))}
          <li>
            <a className="text-[var(--primary)] underline" href="#faq">
              {t.faq}
            </a>
          </li>
        </ol>
      </nav>

      <ol className="mt-8 grid gap-10">
        {guide.steps.map((step, index) => (
          <li className="scroll-mt-6" id={step.id} key={step.id}>
            <h2 className="text-lg font-semibold">
              <span className="mr-2 inline-flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-sm text-[var(--primary-foreground)]">
                {index + 1}
              </span>
              {step.title}
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_220px] md:items-start">
              <div>
                <p className="leading-7">{step.body}</p>
                {step.tip ? (
                  <p className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <Lightbulb aria-hidden className="mt-0.5 shrink-0" size={16} />
                    <span>{step.tip}</span>
                  </p>
                ) : null}
              </div>
              {step.image ? (
                <ScreenshotZoom
                  alt={step.title}
                  closeLabel={t.close}
                  enlargeLabel={t.enlarge}
                  height={SHOT.height}
                  src={screenshot(locale, step.image)}
                  width={SHOT.width}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12 scroll-mt-6" id="faq">
        <h2 className="text-lg font-semibold">{t.faq}</h2>
        <div className="mt-3 grid gap-2">
          {guide.faq.map((item) => (
            <details
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              key={item.q}
            >
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-2 text-sm leading-6">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10">
        <HelpNav from={from} locale={locale} showAllGuides />
      </div>
      <footer className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
        <p>{guide.contact}</p>
        <p className="mt-1">
          {t.screenshotNote} · {t.checkedFor(HELP_CHECKED_FOR)}
        </p>
      </footer>
    </main>
  );
}

/** A4 quick guide: steps in two columns with small screenshots, then FAQ. */
function PrintGuide({ guide, locale }: { guide: HelpGuide; locale: Locale }) {
  const t = HELP_TEXT[locale];

  return (
    <main className="mx-auto max-w-[190mm] bg-white px-2 py-4 text-[12px] text-black" lang={locale}>
      <h1 className="text-xl font-semibold">{guide.printTitle}</h1>
      <p className="mt-1">{guide.summary}</p>
      <ol className="mt-4 grid grid-cols-2 gap-3">
        {guide.steps.map((step, index) => (
          <li className="flex break-inside-avoid gap-3 rounded border border-gray-300 p-2" key={step.id}>
            {step.image ? (
              <Image
                alt=""
                className="h-auto w-[70px] shrink-0 rounded border border-gray-300"
                // The PDF is printed at once; lazy images would be blank.
                loading="eager"
                height={SHOT.height}
                src={screenshot(locale, step.image)}
                width={SHOT.width}
              />
            ) : null}
            <div>
              <p className="font-semibold">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 leading-5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mt-4 break-before-page font-semibold">{t.faq}</h2>
      <dl className="mt-2 grid gap-2">
        {guide.faq.map((item) => (
          <div className="break-inside-avoid" key={item.q}>
            <dt className="font-semibold">{item.q}</dt>
            <dd className="leading-5">{item.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-gray-300 pt-2 text-gray-600">
        {guide.contact} · {t.checkedFor(HELP_CHECKED_FOR)}
      </p>
    </main>
  );
}
