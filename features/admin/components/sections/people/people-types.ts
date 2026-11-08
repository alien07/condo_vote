export type Room = {
  active: boolean | null;
  area_size: number | string | null;
  building: string | null;
  floor: string | null;
  id: string;
  ownership_percent: number | string | null;
  room_number: string;
};

export type Owner = {
  active: boolean | null;
  email: string | null;
  full_name: string;
  id: string;
  line_id: string | null;
  phone: string | null;
};

export type Profile = {
  approval_status: string;
  default_status: string;
  email: string;
  full_name: string;
  id: string;
};

export type AppRole = {
  id: string;
  profile_id: string;
  role: string;
};

export type PeopleCrudPilotProps = {
  activeSection: "owners" | "profiles" | "rooms";
  appRolesByProfile: Map<string, AppRole[]>;
  drawer?: {
    id?: string;
    mode?: string;
    type?: string;
  };
  owners: Owner[];
  profiles: Profile[];
  rooms: Room[];
};

export type RoomTableState = {
  dir: "asc" | "desc";
  page: number;
  perPage: number;
  room: string;
  sort: "room" | "status";
  status: "active" | "all" | "inactive";
};

export type OwnerTableState = {
  dir: "asc" | "desc";
  name: string;
  page: number;
  perPage: number;
  sort: "name" | "status";
  status: "active" | "all" | "inactive";
};

export type ProfileTableState = {
  defaultStatus: "all" | "owner" | "proxy" | "resident";
  dir: "asc" | "desc";
  name: string;
  page: number;
  perPage: number;
  sort: "default_status" | "name";
};
