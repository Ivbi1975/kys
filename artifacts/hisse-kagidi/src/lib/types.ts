export interface Donation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  shareCount: number;
  vekalet: string;
  notes: string;
}

export interface AnimalGroup {
  id: string;
  animalNo: number;
  donations: Donation[];
}

export interface KesimAlani {
  id: string;
  name: string;
  donations: Donation[];
  animalGroups: AnimalGroup[];
  createdAt: string;
}
