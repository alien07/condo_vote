import type { Locale } from "@/lib/i18n/locales";

// The master PDF files of a published result (D021).
export type ResultPdfFile = {
  kind: "official" | "summary";
  language: Locale;
};

export const RESULT_PDF_FILES: ResultPdfFile[] = [
  { kind: "official", language: "th" },
  { kind: "summary", language: "th" },
  { kind: "summary", language: "en" },
];

export function resultPdfPath(snapshotId: string, file: ResultPdfFile) {
  return `${snapshotId}/${file.kind}-${file.language}.pdf`;
}
