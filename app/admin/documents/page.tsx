import Link from "next/link";
import { FolderLock } from "lucide-react";
import { DocumentRegistrationDrawer } from "@/features/admin/components/document-registration-drawer";
import {
  DocumentRegistryTable,
  type DocumentRegistryRow,
} from "@/features/admin/components/document-registry-table";
import {
  fetchDocumentRows,
  type DocumentTableFilters,
} from "@/features/admin/data-modules/documents";
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
    focusDocumentId?: string;
    mode?: string;
    page?: string;
    perPage?: string;
    set?: string;
    sort?: string;
    type?: string;
  }>;
};

function documentListHref(filters: DocumentTableFilters) {
  const params = new URLSearchParams();

  params.set("sort", filters.sortBy ?? "created");
  params.set("dir", filters.dir ?? "desc");
  params.set("perPage", String(filters.perPage ?? 25));

  if (filters.set) {
    params.set("set", filters.set);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  if ((filters.page ?? 1) > 1) {
    params.set("page", String(filters.page));
  }

  return `/admin/documents?${params.toString()}`;
}

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
  const listHref = documentListHref({
    ...filters,
    page: documentRows.documentPage,
    perPage: documentRows.documentPerPage,
  });
  const registerHref = `${listHref}&mode=create`;

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
              href={registerHref}
            >
              Register document
            </Link>
          </div>
        </div>

        <DocumentRegistryTable
          documentTypes={documentTypes}
          focusedDocumentId={params.focusDocumentId}
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
          <DocumentRegistrationDrawer
            closeHref={listHref}
            documentTypes={documentTypes}
          />
        ) : null}
      </section>
    </main>
  );
}
