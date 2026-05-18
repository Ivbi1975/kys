import type { AiClassificationResult } from "@/lib/api";

export interface LocalDonation {
  id: string;
  name: string;
  description: string;
  donationType: string;
  vekalet: string;
  notes: string;
  aiCategories?: string[];
  aiWarnings?: string;
  isFlagged?: boolean;
}

export interface AiResult extends AiClassificationResult {
  donationType?: string;
}

export const MAX_HISTORY = 50;

export interface HistoryDiff {
  changes: Map<string, { prevNotes: string; prevDesc: string; nextNotes: string; nextDesc: string }>;
}
