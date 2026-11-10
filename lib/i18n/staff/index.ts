import { adminHomeText } from "@/lib/i18n/staff/admin-home";
import { commonText } from "@/lib/i18n/staff/common";
import { committeeText } from "@/lib/i18n/staff/committee";
import { systemText } from "@/lib/i18n/staff/system";
import type { Locale } from "@/lib/i18n/locales";

// Words for staff pages (admin, committee, system), Thai by default like the
// owner pages (D020). Plain strings only, with "{name}" placeholders filled
// by fill(), so the dictionary can be passed to client components.

const areas = {
  adminHome: adminHomeText,
  common: commonText,
  committee: committeeText,
  system: systemText,
};

type Areas = typeof areas;

export type StaffDictionary = { [Area in keyof Areas]: Areas[Area]["en"] };

export function getStaffDictionary(locale: Locale): StaffDictionary {
  return Object.fromEntries(
    Object.entries(areas).map(([area, text]) => [area, text[locale]]),
  ) as StaffDictionary;
}
