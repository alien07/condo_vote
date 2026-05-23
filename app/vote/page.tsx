import { Vote } from "lucide-react";
import { requireProfile } from "@/lib/auth/permissions";

export default async function VotePage() {
  await requireProfile();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Vote className="text-[var(--primary)]" size={26} />
          <div>
            <h1 className="text-2xl font-semibold">Vote</h1>
            <p className="text-sm text-[var(--muted)]">
              Eligible owners and approved proxies will vote from this area.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          Voting flow will use meeting eligibility snapshots and ballot versions.
        </div>
      </section>
    </main>
  );
}
