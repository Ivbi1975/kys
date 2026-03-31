export type ColorTag = "green" | "orange" | "red" | "";

export interface CustomTag {
  id: string;
  name: string;
  color: string;
}

export interface Donation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
  phone?: string;
  excluded?: boolean;
  tags?: string[];
  aiCategories?: string[];
  aiWarnings?: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface AnimalGroup {
  id: string;
  animalNo: number;
  donations: Donation[];
  colorTag?: ColorTag;
  locked?: boolean;
  notes?: string;
  kesildi?: boolean;
  kesildiAt?: string | null;
  teamId?: string | null;
}

export interface KesimAlani {
  id: string;
  name: string;
  donations: Donation[];
  animalGroups: AnimalGroup[];
  createdAt: string;
  deletedAt?: string | null;
  projectId?: string | null;
  customTags?: CustomTag[];
  trackingToken?: string | null;
  kesimListeId?: string | null;
  teams?: Team[];
  parentKesimAlaniId?: string | null;
  splitStatus?: string | null;
}

export interface ProjectStats {
  donorCount: number;
  shareCount: number;
  groupCount: number;
  kesildiCount: number;
  lastKesildiAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
  stats: ProjectStats;
}
