import { getStaffI18n } from "@/lib/i18n/server";
import { Building2 } from "lucide-react";
import { OwnershipManager } from "@/features/admin/components/ownership-manager";
import type {
  AdminDashboardData,
  AdminWorkspaceProps,
} from "@/features/admin/components/sections/types";

type OwnershipSectionProps = Pick<AdminDashboardData, "owners" | "roomOwners" | "rooms"> &
  Pick<AdminWorkspaceProps, "drawer" | "ownershipCreateHref"> & {
  hidden: boolean;
};

export async function OwnershipSection({
  drawer,
  owners,
  ownershipCreateHref,
  roomOwners,
  rooms,
  hidden,
}: OwnershipSectionProps) {
  const { s } = await getStaffI18n();

  return (
    <section
      className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">{s.ownership.title}</h2>
            <p className="text-sm text-[var(--muted)]">
              {s.ownership.intro}
            </p>
          </div>
        </div>
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          href={
            ownershipCreateHref ??
            "/admin/ownership?mode=create&type=ownership_link"
          }
        >
          {s.ownership.create}
        </a>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-[var(--muted)]">
        {s.ownership.help}
      </p>
      <OwnershipManager
        drawer={drawer}
        owners={owners}
        roomOwners={roomOwners}
        rooms={rooms}
      />
    </section>
  );
}
