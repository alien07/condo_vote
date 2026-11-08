"use client";

import { OwnersPanel } from "@/features/admin/components/sections/people/owners-panel";
import { ProfilesPanel } from "@/features/admin/components/sections/people/profiles-panel";
import { RoomsPanel } from "@/features/admin/components/sections/people/rooms-panel";
import type { PeopleCrudPilotProps } from "@/features/admin/components/sections/people/people-types";

export function PeopleCrudPilot({
  activeSection,
  appRolesByProfile,
  drawer,
  owners,
  profiles,
  rooms,
}: PeopleCrudPilotProps) {
  if (activeSection === "profiles") {
    return (
      <ProfilesPanel
        activeSection={activeSection}
        appRolesByProfile={appRolesByProfile}
        drawer={drawer}
        profiles={profiles}
      />
    );
  }

  if (activeSection === "owners") {
    return (
      <OwnersPanel
        activeSection={activeSection}
        drawer={drawer}
        owners={owners}
      />
    );
  }

  return (
    <RoomsPanel
      activeSection={activeSection}
      drawer={drawer}
      rooms={rooms}
    />
  );
}
