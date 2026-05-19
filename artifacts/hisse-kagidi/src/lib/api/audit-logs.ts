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
