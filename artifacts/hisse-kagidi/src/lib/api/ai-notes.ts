import { apiFetch } from "./core";

export interface AiDonationInput {
  id: string;
  name: string;
  donationType: string;
  vekalet: string;
  notes: string;
}

export interface AiClassificationResult {
  donationId: string;
  categories: string[];
  requests: string;
  warnings: string;
  summary: string;
}

export interface AiSettings {
  prompt: string;
  categories: string[];
}

export async function fetchAiSettings(): Promise<AiSettings> {
  return apiFetch<AiSettings>("/ai-notes/settings");
}

export async function saveAiSettings(settings: Partial<AiSettings>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function classifyNotes(donations: AiDonationInput[]): Promise<{ results: AiClassificationResult[] }> {
  return apiFetch<{ results: AiClassificationResult[] }>("/ai-notes/classify", {
    method: "POST",
    body: JSON.stringify({ donations }),
  });
}

export async function saveAiClassifications(classifications: { donationId: string; categories: string[]; warnings: string }[]): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/save-classifications", {
    method: "PUT",
    body: JSON.stringify({ classifications }),
  });
}

export async function bulkUpdateNotes(kesimAlaniId: string, updates: { donationId: string; notes: string }[]): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/ai-notes/bulk-update", {
    method: "PUT",
    body: JSON.stringify({ kesimAlaniId, updates }),
  });
}
