import { apiFetch } from "./core";

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  oldValue: unknown;
  newValue: unknown;
  sourceType: string;
  sourceIdentifier: string | null;
  ipAddress: string | null;
  createdAt: string;
  projectId: string | null;
  filters: unknown;
  targetKesimAlaniId: string | null;
  affectedCount: number | null;
  metadata: unknown;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  hasMore: boolean;
  nextCursor: number | null;
  creationLog?: AuditLogEntry | null;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: number;
  projectId?: string;
  kesimAlaniId?: string;
  poolScope?: boolean;
}

export async function fetchAuditLogs(filters: AuditLogFilters = {}, signal?: AbortSignal): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", String(filters.cursor));
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.kesimAlaniId) params.set("kesimAlaniId", filters.kesimAlaniId);
  if (filters.poolScope) params.set("poolScope", "1");
  const qs = params.toString();
  return apiFetch<AuditLogResponse>(`/audit-logs${qs ? `?${qs}` : ""}`, { signal });
}

export interface ProjectAuditLogFilters {
  scope?: "all" | "havuz" | "kesim";
  kesimAlaniId?: string;
  cursor?: number;
  limit?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchProjectAuditLogs(
  projectId: string,
  filters: ProjectAuditLogFilters = {},
  signal?: AbortSignal,
): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.kesimAlaniId) params.set("kesimAlaniId", filters.kesimAlaniId);
  if (filters.cursor) params.set("cursor", String(filters.cursor));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.action) params.set("action", filters.action);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  const qs = params.toString();
  return apiFetch<AuditLogResponse>(
    `/projects/${projectId}/audit-logs${qs ? `?${qs}` : ""}`,
    { signal },
  );
}

export async function undoProjectAuditLog(
  projectId: string,
  logId: number,
): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>(
    `/projects/${projectId}/audit-logs/${logId}/undo`,
    { method: "POST" },
  );
}

export function isReversibleEntry(entry: AuditLogEntry): boolean {
  const meta = entry.metadata as Record<string, unknown> | null;
  if (!meta) return false;
  if (meta.undone === true) return false;
  return entry.action === "bulk_transfer" && !!meta.batchId;
}
