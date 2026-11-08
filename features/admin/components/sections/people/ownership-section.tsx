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

export function OwnershipSection({
  drawer,
  owners,
  ownershipCreateHref,
  roomOwners,
  rooms,
  hidden,
}: OwnershipSectionProps) {

  return (
    <section
      className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="text-[var(--primary)]" size={20} />
          <div>
            <h2 className="text-lg font-semibold">Room Ownership</h2>
            <p className="text-sm text-[var(--muted)]">
              Maintain current room-owner links and effective dates.
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
          Create ownership link
        </a>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-[var(--muted)]">
        Maintain the active owner for each room. In v1, one room can have
        one active owner link. To transfer ownership, end the current active
        link first, then create a new link for the new owner.
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
