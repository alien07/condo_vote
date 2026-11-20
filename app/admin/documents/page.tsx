import { getStaffI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { FolderLock } from "lucide-react";
import { DocumentRegistrationDrawer } from "@/features/admin/components/document-registration-drawer";
import { DocumentDetailsDrawer } from "@/features/admin/components/sections/documents/document-details-drawer";
import { DOCUMENT_TYPES } from "@/features/admin/components/sections/documents/document-labels";
import {
  fetchDocumentFilterChoices,
  fetchDocumentOwnerChoices,
} from "@/features/admin/data-modules/document-pickers";
import { fetchDocumentById } from "@/features/admin/data-modules/documents";
import { roomFilterOptions } from "@/features/ui/search-options";
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

type AdminDocumentsPageProps = {
  searchParams: Promise<{
    dir?: string;
    focusDocumentId?: string;
    from?: string;
    id?: string;
    mode?: string;
    owner?: string;
    room?: string;
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

  if (filters.room) {
    params.set("room", filters.room);
  }

  if (filters.owner) {
    params.set("owner", filters.owner);
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

function uuidOrUndefined(value: string | undefined) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
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
    owner: uuidOrUndefined(params.owner),
    page: positiveInteger(params.page, 1),
    perPage: positiveInteger(params.perPage, 25),
    room: uuidOrUndefined(params.room),
    set: params.set,
    sortBy,
    type: params.type,
  };
}

export default async function AdminDocumentsPage({
  searchParams,
}: AdminDocumentsPageProps) {
  const { s } = await getStaffI18n();
  await requireAdmin({ readOnly: true });

  const params = await searchParams;
  const filters = getDocumentFilters(params);
  const supabase = await createClient();
  const fromId = params.mode === "create" ? uuidOrUndefined(params.from) : undefined;
  const viewId = params.mode === "view" ? uuidOrUndefined(params.id) : undefined;
  const [documentRows, filterChoices, ownerChoices, sourceDocument, viewedDocument] = await Promise.all([
    fetchDocumentRows(supabase, filters),
    fetchDocumentFilterChoices(supabase),
    params.mode === "create" ? fetchDocumentOwnerChoices(supabase) : null,
    fromId ? fetchDocumentById(supabase, fromId) : null,
    viewId ? fetchDocumentById(supabase, viewId) : null,
  ]);
  const ownerOptions = filterChoices.owners
    .map((owner) => ({
      value: owner.id,
      label: owner.full_name,
      hint: [owner.email, owner.phone].filter(Boolean).join(" · ") || undefined,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
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
            <div className="flex min-w-0 items-start gap-3">
              <FolderLock className="mt-1 shrink-0 text-[var(--primary)]" size={26} />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">{s.documents.title}</h1>
                <p className="text-sm text-[var(--muted)]">
                  {s.documents.intro}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
              href={registerHref}
            >
              {s.documents.register}
            </Link>
          </div>
        </div>

        <DocumentRegistryTable
          documentTypes={DOCUMENT_TYPES}
          ownerOptions={ownerOptions}
          roomOptions={roomFilterOptions(filterChoices.rooms)}
          focusedDocumentId={params.focusDocumentId}
          initialFilters={{
            dir: filters.dir ?? "desc",
            owner: filters.owner ?? "",
            page: documentRows.documentPage,
            perPage: documentRows.documentPerPage,
            room: filters.room ?? "",
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
            filters.room ?? "",
            filters.owner ?? "",
            filters.type ?? "all",
            filters.sortBy ?? "created",
            filters.dir ?? "desc",
            documentRows.documentPage,
            documentRows.documentPerPage,
          ].join(":")}
        />

        {params.mode === "create" && ownerChoices ? (
          <DocumentRegistrationDrawer
            closeHref={listHref}
            documentTypes={DOCUMENT_TYPES}
            ownerChoices={ownerChoices}
            source={sourceDocument}
          />
        ) : null}
        {viewedDocument ? (
          <DocumentDetailsDrawer
            closeHref={listHref}
            document={viewedDocument}
            versionHref={`${listHref}&mode=create&from=${viewedDocument.id}`}
          />
        ) : null}
      </section>
    </main>
  );
}
