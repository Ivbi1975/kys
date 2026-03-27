export const TAG_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
] as const;

export const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

export type DonorFieldKey = "name" | "description" | "donationType" | "vekalet" | "notes";

export const FIELD_LABELS: Record<DonorFieldKey, string> = {
  name: "Adına Kesilen",
  description: "Vekaleti Veren",
  donationType: "Cinsi",
  vekalet: "Vekalet",
  notes: "Notlar",
};

export const NoteType = {
  NOTE: "note",
  EDIT_REQUEST: "edit_request",
} as const;
export type NoteType = (typeof NoteType)[keyof typeof NoteType];

export const NoteStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type NoteStatus = (typeof NoteStatus)[keyof typeof NoteStatus];
