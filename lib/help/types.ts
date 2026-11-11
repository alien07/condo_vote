// Content shape for the in-app help pages (/help). Text lives in TypeScript,
// per language, so the build fails when a language misses a field.

export type HelpStep = {
  /** Anchor on the page, e.g. /help/owner#vote. */
  id: string;
  title: string;
  body: string;
  tip?: string;
  /** Screenshot name: public/help/<locale>/<image>.png */
  image?: string;
};

export type HelpFaq = { q: string; a: string };

export type HelpGuide = {
  slug: string;
  audience: string;
  title: string;
  summary: string;
  /** Heading of the printable quick guide (PDF). */
  printTitle: string;
  steps: HelpStep[];
  faq: HelpFaq[];
  contact: string;
};
