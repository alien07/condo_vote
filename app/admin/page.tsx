import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/permissions";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">Admin</h1>
            <p className="text-sm text-[var(--muted)]">
              Room, owner, meeting, approval, and result management.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          Admin workflows are documented in docs/admin-workflows.md.
        </div>
      </section>
    </main>
  );
}
