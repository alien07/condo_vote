import { createHash } from "node:crypto";
import { launchPdfBrowser } from "@/lib/pdf/browser";
import { RESULT_PDF_FILES, resultPdfPath } from "@/features/results/pdf/files";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Master PDF files of a published result (D021): the official record (Thai)
// and the owner summary in Thai and English. Each file is printed from the
// same page people see, stored in the private result-documents bucket, and
// recorded with its SHA-256. Files that already exist are kept as they are.

export type GenerateResultPdfsInput = {
  supabase: SupabaseServerClient;
  snapshotId: string;
  /** Origin of this app, for example https://condovotes.example.com. */
  origin: string;
  /** The signed-in user's cookies, so the browser can open the pages. */
  cookies: { name: string; value: string }[];
};

export async function generateResultPdfs({
  supabase,
  snapshotId,
  origin,
  cookies,
}: GenerateResultPdfsInput) {
  const [snapshotResult, existingResult] = await Promise.all([
    supabase
      .from("result_snapshots")
      .select("meeting_id, result_publications(id)")
      .eq("id", snapshotId)
      .single(),
    supabase.from("result_documents").select("kind, language").eq("result_snapshot_id", snapshotId),
  ]);

  if (snapshotResult.error) {
    throw snapshotResult.error;
  }

  if (existingResult.error) {
    throw existingResult.error;
  }

  const publications = snapshotResult.data.result_publications;

  if (!publications || (Array.isArray(publications) && publications.length === 0)) {
    throw new Error("PDF files are made only for published results.");
  }

  const existing = new Set(existingResult.data.map((row) => `${row.kind}-${row.language}`));
  const missing = RESULT_PDF_FILES.filter(
    (file) => !existing.has(`${file.kind}-${file.language}`),
  );

  if (missing.length === 0) {
    return { created: 0 };
  }

  const browser = await launchPdfBrowser();

  try {
    for (const file of missing) {
      const context = await browser.newContext();

      await context.addCookies([
        ...cookies
          .filter((cookie) => cookie.name !== "lang")
          .map((cookie) => ({ ...cookie, url: origin })),
        { name: "lang", value: file.language, url: origin },
      ]);

      const page = await context.newPage();
      const url =
        file.kind === "official"
          ? `${origin}/record/${snapshotId}`
          : `${origin}/summary/${snapshotResult.data.meeting_id}`;
      const response = await page.goto(url, { waitUntil: "networkidle" });

      if (!response?.ok() || !page.url().startsWith(url)) {
        throw new Error(`Could not open ${url} to print the ${file.kind} PDF.`);
      }

      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
      });

      await context.close();

      const path = resultPdfPath(snapshotId, file);
      const upload = await supabase.storage.from("result-documents").upload(path, pdf, {
        contentType: "application/pdf",
        // A file without a result_documents row is left over from a failed try.
        upsert: true,
      });

      if (upload.error) {
        throw upload.error;
      }

      const { error } = await supabase.from("result_documents").insert({
        result_snapshot_id: snapshotId,
        kind: file.kind,
        language: file.language,
        storage_path: path,
        sha256: createHash("sha256").update(pdf).digest("hex"),
        byte_size: pdf.byteLength,
      });

      if (error) {
        throw error;
      }
    }
  } finally {
    await browser.close();
  }

  return { created: missing.length };
}
