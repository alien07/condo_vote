import { adminHomeText } from "@/lib/i18n/staff/admin-home";
import { commonText } from "@/lib/i18n/staff/common";
import { committeeText } from "@/lib/i18n/staff/committee";
import { documentsText } from "@/lib/i18n/staff/documents";
import { meetingsText } from "@/lib/i18n/staff/meetings";
import { ownershipText } from "@/lib/i18n/staff/ownership";
import { peopleText } from "@/lib/i18n/staff/people";
import { setupText } from "@/lib/i18n/staff/setup";
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
  setup: setupText,
  documents: documentsText,
  people: peopleText,
  ownership: ownershipText,
  meetings: meetingsText,
};

type Areas = typeof areas;

export type StaffDictionary = { [Area in keyof Areas]: Areas[Area]["en"] };

export function getStaffDictionary(locale: Locale): StaffDictionary {
  return Object.fromEntries(
    Object.entries(areas).map(([area, text]) => [area, text[locale]]),
  ) as StaffDictionary;
}
