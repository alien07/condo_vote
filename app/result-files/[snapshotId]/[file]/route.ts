import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FILE = /^(official|summary)-(th|en)\.pdf$/;

// Downloads a master PDF file (D021). Row and file access follow RLS: admin
// and committee get every file, other signed-in users get published summaries.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string; file: string }> },
) {
  const { snapshotId, file } = await params;

  if (!FILE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const path = `${snapshotId}/${file}`;
  const { data: row } = await supabase
    .from("result_documents")
    .select("storage_path")
    .eq("storage_path", path)
    .maybeSingle();

  if (!row) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("result-documents")
    .createSignedUrl(path, 60, { download: `result-${snapshotId.slice(0, 8)}-${file}` });

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
