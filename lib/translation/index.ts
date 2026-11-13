import { DEMO_TRANSLATIONS } from "@/lib/translation/demo-translations";
import { TRANSLATION_GLOSSARY } from "@/lib/translation/glossary";

// Thai to English drafts for admin-typed content (demo feedback item 6b).
// Server only: call it from server actions.
// Text leaves the system only when an admin presses "Translate", from the
// server, with the key kept in the server environment.
//
// TRANSLATION_PROVIDER: "azure" (Azure AI Translator, free tier F0) or "mock"
// (answers from the demo list). Without an Azure key the provider is "mock".
// Azure needs AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION; the endpoint
// can be changed with AZURE_TRANSLATOR_ENDPOINT.

export const NO_DEMO_TRANSLATION = "[no demo translation]";

export type TranslationProvider = "azure" | "mock";

export function translationProvider(): TranslationProvider {
  const configured = process.env.TRANSLATION_PROVIDER;

  if (configured === "azure" && process.env.AZURE_TRANSLATOR_KEY) {
    return "azure";
  }

  if (!configured && process.env.AZURE_TRANSLATOR_KEY) {
    return "azure";
  }

  return "mock";
}

/** Demo provider: the prepared English, or the Thai marked for the admin. */
export function mockTranslate(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  return DEMO_TRANSLATIONS[trimmed] ?? `${NO_DEMO_TRANSLATION} ${trimmed}`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const glossaryTerms = [...TRANSLATION_GLOSSARY].sort((a, b) => b[0].length - a[0].length);
const glossaryPattern = new RegExp(
  glossaryTerms.map(([thai]) => thai.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);
const glossaryEnglish = new Map(glossaryTerms);

/** Wraps glossary terms in Azure's dynamic dictionary markup, longest term
 * first, in one pass so a term inside a longer one is not wrapped twice. */
export function withGlossary(text: string) {
  return escapeXml(text).replace(
    glossaryPattern,
    (thai) =>
      `<mstrans:dictionary translation="${escapeXml(glossaryEnglish.get(thai) ?? thai)}">${thai}</mstrans:dictionary>`,
  );
}

async function azureTranslate(texts: string[]) {
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT ?? "https://api.cognitive.microsofttranslator.com";
  const response = await fetch(`${endpoint}/translate?api-version=3.0&from=th&to=en&textType=html`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY ?? "",
      ...(process.env.AZURE_TRANSLATOR_REGION
        ? { "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATOR_REGION }
        : {}),
    },
    body: JSON.stringify(texts.map((text) => ({ Text: withGlossary(text) }))),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Translation failed (${response.status}). Type the English instead.`);
  }

  const data = (await response.json()) as Array<{ translations?: Array<{ text?: string }> }>;

  return data.map((item) =>
    (item.translations?.[0]?.text ?? "")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"),
  );
}

/** Translates Thai texts to English drafts, in order. Empty texts stay empty. */
export async function translateToEnglish(texts: string[]) {
  if (translationProvider() === "mock") {
    return texts.map(mockTranslate);
  }

  const indexes = texts.map((text, index) => (text.trim() ? index : -1)).filter((index) => index >= 0);
  const results = texts.map(() => "");

  // Azure takes up to 100 texts per request.
  for (let start = 0; start < indexes.length; start += 100) {
    const batch = indexes.slice(start, start + 100);
    const translated = await azureTranslate(batch.map((index) => texts[index]));

    batch.forEach((index, position) => {
      results[index] = translated[position] ?? "";
    });
  }

  return results;
}
