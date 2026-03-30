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
}

export interface AiResult extends AiClassificationResult {
  donationType?: string;
}

export const MAX_HISTORY = 50;
