import { Building2 } from "lucide-react";
import { JuristicProfileForm } from "@/features/admin/components/setup-settings-forms";
import type {
  AdminDashboardData,
} from "@/features/admin/components/sections/types";

type JuristicProfileSectionProps = Pick<AdminDashboardData, "condoProfile"> & {
  hidden: boolean;
};

export function JuristicProfileSection({
  condoProfile,
  hidden,
}: JuristicProfileSectionProps) {

  return (
    <section
      className="mb-5 scroll-mt-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
      hidden={hidden}
      id="setup"
    >
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="text-[var(--primary)]" size={20} />
        <h2 className="text-lg font-semibold">Juristic Person</h2>
      </div>
      <JuristicProfileForm condoProfile={condoProfile} />
    </section>
  );
}
