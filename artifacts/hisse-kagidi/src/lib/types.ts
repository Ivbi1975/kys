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
  birim?: string;
  temsilci?: string;
  ozellik?: string;
  fiyat?: string;
  yerTalebi?: string;
  gunTalebi?: string;
  ilkHayvan?: string;
  safi?: string;
  excluded?: boolean;
  tags?: string[];
  aiCategories?: string[];
  aiWarnings?: string;
  isFlagged?: boolean;
  flagReason?: string;
}

export interface PoolDonation extends Donation {
  kesimAlaniId: string;
  kesimAlaniName: string;
}

export interface PoolStats {
  total: number;
  active: number;
  excluded: number;
  total_shares: number;
  birim_count: number;
  temsilci_count: number;
  type_count: number;
  empty_type_count: number;
  empty_birim_count: number;
  empty_temsilci_count: number;
  empty_ozellik_count: number;
  empty_fiyat_count: number;
  empty_yer_talebi_count: number;
  empty_gun_talebi_count: number;
  empty_ilk_hayvan_count: number;
  empty_safi_count: number;
  birimDistribution: { birim: string; count: number; shares: number }[];
  temsilciDistribution: { temsilci: string; count: number; shares: number }[];
  typeDistribution: { type: string; count: number; shares: number }[];
  kesimAlaniDistribution: { id: string; name: string; count: number; shares: number }[];
  multiLocationVekalets: string[];
  multiLocationNames: { name: string; count: number; vekalets: string[] }[];
  transferredToLists: number;
  inGroups: number;
  ozellikDistribution: { ozellik: string; count: number }[];
  fiyatDistribution: { fiyat: string; count: number }[];
  yerTalebiDistribution: { yerTalebi: string; count: number }[];
  gunTalebiDistribution: { gunTalebi: string; count: number }[];
  ilkHayvanDistribution: { ilkHayvan: string; count: number }[];
  safiDistribution: { safi: string; count: number }[];
  tagDistribution?: { id: string; name: string; color: string; count: number }[];
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
  updatedAt?: string;
}

export interface KesimAlani {
  id: string;
  name: string;
  donations: Donation[];
  animalGroups: AnimalGroup[];
  createdAt: string;
  deletedAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  customTags?: CustomTag[];
  trackingToken?: string | null;
  kesimListeId?: string | null;
  yetkili?: string | null;
  displayName?: string | null;
  maxVekalet?: number | null;
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

export interface ProjectWarnings {
  unassignedShares: number;
  duplicateVekalets: number;
  wrongCountGroups: number;
  missingVekalet: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
  stats: ProjectStats;
  warnings?: ProjectWarnings;
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: string | string[] | number | [number, number];
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: RuleCondition[];
}

export interface CompoundConditions {
  logic: "AND" | "OR";
  groups: ConditionGroup[];
}

export interface RuleAction {
  type: "transfer_to_ka" | "add_tag" | "flag" | "exclude";
  targetKesimAlaniId?: string;
  tagId?: string;
  flagReason?: string;
}

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  conditions: RuleCondition[] | CompoundConditions;
  action: RuleAction;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleExecutionSummaryItem {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
  affectedCount: number;
  affectedDonationIds: string[];
}

export interface RuleExecutionResult {
  totalAffected: number;
  ruleResults: RuleExecutionSummaryItem[];
}
