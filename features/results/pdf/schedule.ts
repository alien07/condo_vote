import { after } from "next/server";
import { pdfRequestContext } from "@/features/results/pdf/request";
import { generateResultPdfs } from "@/features/results/pdf/generate";
import { createClient } from "@/lib/supabase/server";

// Starts the master PDF files after the response is sent, so approving does
// not wait for Chromium (D021). A failure leaves the result published; admin
// sees "Create PDF files" on the results list and can try again.
export async function scheduleResultPdfs(snapshotId: string) {
  const { origin, cookies } = await pdfRequestContext();
  const supabase = await createClient();

  after(async () => {
    try {
      await generateResultPdfs({ supabase, snapshotId, origin, cookies });
    } catch (error) {
      console.error(
        `[condoVotes] result PDF files failed for ${snapshotId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  });
}
