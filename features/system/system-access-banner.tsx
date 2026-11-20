import { Eye } from "lucide-react";
import { getSystemAccessStatus } from "@/features/system/access-service";
import { formatDateTimeIn } from "@/lib/i18n/format";
import { getStaffI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/template";
import { createClient } from "@/lib/supabase/server";

/**
 * "System Admin … has temporary access until …" (req_0011 B, D027).
 * `mine`: the System Admin's own read-only notice (every page while open).
 * `others`: the Manager's overview and /audit.
 */
export async function SystemAccessBanner({ only }: { only: "mine" | "others" }) {
  const status = await getSystemAccessStatus(await createClient());
  const entries = (status?.active ?? []).filter((entry) => (only === "mine" ? entry.mine : !entry.mine));

  if (entries.length === 0) {
    return null;
  }

  const { locale, s } = await getStaffI18n();
  const t = s.system.access;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 md:px-6" data-system-access-banner={only}>
      {entries.map((entry) => (
        <p
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          key={entry.id}
          role="status"
        >
          <Eye aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span className="[overflow-wrap:anywhere]">
            {only === "mine"
              ? fill(t.bannerMine, { time: formatDateTimeIn(locale, entry.ends_at) })
              : fill(t.bannerOthers, {
                  name: entry.name ?? "-",
                  time: formatDateTimeIn(locale, entry.ends_at),
                  reason: entry.reason,
                })}
          </span>
        </p>
      ))}
    </div>
  );
}
