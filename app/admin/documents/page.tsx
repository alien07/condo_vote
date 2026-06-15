import Link from "next/link";
import { FolderLock } from "lucide-react";
import { AdminCrudDrawer } from "@/features/admin/components/admin-crud-drawer";
import { FieldLabel, RequiredNote } from "@/features/admin/components/field-label";
import { FormResetButton } from "@/features/admin/components/form-controls";
import {
  DocumentRegistryTable,
  type DocumentRegistryRow,
} from "@/features/admin/components/document-registry-table";
import { registerDocumentReference } from "@/features/admin/action-modules/documents";
import {
  fetchDocumentRows,
  type DocumentTableFilters,
} from "@/features/admin/data-modules/documents";
import { PendingSubmitButton } from "@/features/debug/tracked-submit-button";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const documentTypes = [
  "owner_verification",
  "proxy_authorization",
  "meeting_attachment",
  "result_pdf",
  "other",
];

type AdminDocumentsPageProps = {
  searchParams: Promise<{
    dir?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    set?: string;
    sort?: string;
    type?: string;
  }>;
};

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDocumentFilters(
  params: Awaited<AdminDocumentsPageProps["searchParams"]>,
): DocumentTableFilters {
  const sortBy =
    params.sort === "created" || params.sort === "set" || params.sort === "type"
      ? params.sort
      : "created";

  return {
    dir: params.dir === "asc" ? "asc" : "desc",
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    set: params.set,
    sortBy,
    type: params.type,
  };
}

export default async function AdminDocumentsPage({
  searchParams,
}: AdminDocumentsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const filters = getDocumentFilters(params);
  const supabase = await createClient();
  const documentRows = await fetchDocumentRows(supabase, filters);

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <FolderLock className="text-[var(--primary)]" size={26} />
              <div>
                <h1 className="text-2xl font-semibold">Documents</h1>
                <p className="text-sm text-[var(--muted)]">
                  Search private document references and register document
                  verification metadata.
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href="/admin/documents?mode=create"
            >
              Register document
            </Link>
          </div>
        </div>

        <DocumentRegistryTable
          documentTypes={documentTypes}
          initialFilters={{
            dir: filters.dir ?? "desc",
            page: documentRows.documentPage,
            perPage: documentRows.documentPerPage,
            set: filters.set ?? "",
            sort: filters.sortBy ?? "created",
            type: filters.type ?? "all",
          }}
          initialPage={documentRows.documentPage}
          initialPerPage={documentRows.documentPerPage}
          initialRows={documentRows.documents as DocumentRegistryRow[]}
          initialTotal={documentRows.documentTotal}
          key={[
            filters.set ?? "",
            filters.type ?? "all",
            filters.sortBy ?? "created",
            filters.dir ?? "desc",
            documentRows.documentPage,
            documentRows.documentPerPage,
          ].join(":")}
        />

        {params.mode === "create" ? (
          <AdminCrudDrawer
            closeHref="/admin/documents"
            summary={["New private document reference"]}
            title="Register document"
          >
            <form action={registerDocumentReference} className="grid gap-3">
              <RequiredNote />
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Storage provider</FieldLabel>
                <select
                  autoFocus
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  defaultValue="local_drive"
                  name="storage_provider"
                  required
                >
                  <option value="local_drive">Local drive</option>
                  <option value="google_drive">Google Drive</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Owner type</FieldLabel>
                <select
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="owner_type"
                  required
                >
                  <option value="profile">Profile</option>
                  <option value="approval_request">Approval request</option>
                  <option value="proxy_authorization">Proxy authorization</option>
                  <option value="meeting">Meeting</option>
                  <option value="result_snapshot">Result snapshot</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Document type</FieldLabel>
                <select
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="document_type"
                  required
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Owner UUID</FieldLabel>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="owner_id"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>
                  Relative path or private Drive file link
                </FieldLabel>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="storage_path"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Document set key</FieldLabel>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  name="document_set_key"
                  placeholder="proxy-meeting-room"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <FieldLabel required>Version</FieldLabel>
                <input
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  defaultValue={1}
                  min={1}
                  name="document_version"
                  required
                  type="number"
                />
              </label>
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="original_filename"
                placeholder="Original filename"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="mime_type"
                placeholder="MIME type"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                min={0}
                name="file_size_bytes"
                placeholder="File size bytes"
                type="number"
              />
              <input
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                name="checksum_sha256"
                placeholder="SHA-256 checksum, 64 hex characters"
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <PendingSubmitButton
                  className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                  pendingLabel="Adding..."
                  type="submit"
                >
                  Register document
                </PendingSubmitButton>
                <FormResetButton label="Clear form" />
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
                  href="/admin/documents"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </AdminCrudDrawer>
        ) : null}
      </section>
    </main>
  );
}
