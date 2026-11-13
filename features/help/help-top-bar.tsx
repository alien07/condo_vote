import Link from "next/link";
import { ArrowLeft, BookOpen, Home } from "lucide-react";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { HELP_TEXT } from "@/lib/help";
import type { Locale } from "@/lib/i18n/locales";

/** App page the "?" button came from, if it is safe to go back to. */
export function safeFrom(value: string | string[] | undefined) {
  const from = Array.isArray(value) ? value[0] : value;

  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/help")) {
    return null;
  }

  return from;
}

export function withFrom(href: string, from: string | null) {
  if (!from) {
    return href;
  }

  const [path, hash] = href.split("#");
  return `${path}?from=${encodeURIComponent(from)}${hash ? `#${hash}` : ""}`;
}

// Way out of the help pages: back to the page the "?" was pressed on, or
// home. Shown at the top and the bottom of long guides.
export function HelpNav({
  from,
  locale,
  showAllGuides = false,
}: {
  from: string | null;
  locale: Locale;
  showAllGuides?: boolean;
}) {
  const t = HELP_TEXT[locale];
  const linkClass =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface)]";

  return (
    <nav aria-label={t.title} className="flex flex-wrap items-center gap-x-2">
      <Link className={linkClass} href={from ?? "/"}>
        {from ? <ArrowLeft aria-hidden size={16} /> : <Home aria-hidden size={16} />}
        {from ? t.back : t.home}
      </Link>
      {showAllGuides ? (
        <Link className={linkClass} href={withFrom("/help", from)}>
          <BookOpen aria-hidden size={16} />
          {t.allGuides}
        </Link>
      ) : null}
    </nav>
  );
}

export function HelpTopBar(props: { from: string | null; locale: Locale; showAllGuides?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <HelpNav {...props} />
      <LanguageSwitcher locale={props.locale} />
    </div>
  );
}
