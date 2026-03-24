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
  excluded?: boolean;
  tags?: string[];
}

export interface AnimalGroup {
  id: string;
  animalNo: number;
  donations: Donation[];
  colorTag?: ColorTag;
  locked?: boolean;
  notes?: string;
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
}

export interface ProjectStats {
  donorCount: number;
  shareCount: number;
  groupCount: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  deletedAt?: string | null;
  stats: ProjectStats;
}
