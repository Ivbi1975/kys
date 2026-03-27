export const BATCH_SIZE = 500;
export const LARGE_BATCH_SIZE = 5000;
export const TX_BATCH_SIZE = 100;
export const CURSOR_BATCH_SIZE = 500;
export const MAX_QUERY_LIMIT = 500;

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

export const AiJobStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type AiJobStatus = (typeof AiJobStatus)[keyof typeof AiJobStatus];

export const STALE_JOB_CUTOFF_MS = 24 * 60 * 60 * 1000;
export const STALE_JOB_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export const ERROR_MESSAGES = {
  INVALID_DATA: "Geçersiz veri",
  NOT_FOUND: "Bulunamadı",
  PROJECT_NOT_FOUND: "Proje bulunamadı",
  KESIM_ALANI_NOT_FOUND: "Kesim alanı bulunamadı",
  UNKNOWN_ERROR: "Bilinmeyen hata",
  DELETED_PROJECT_CANNOT_ARCHIVE: "Silinmiş proje arşivlenemez",
  PROJECT_ALREADY_ARCHIVED: "Proje zaten arşivlenmiş",
  PROJECT_NOT_ARCHIVED: "Proje arşivde değil",
  SERVER_CONFIG_ERROR: "Sunucu yapılandırma hatası.",
  WRONG_PASSWORD: "Şifre hatalı.",
  SERVER_RESTARTED: "Sunucu yeniden başlatıldı",
  INVALID_STATUS: "Geçersiz durum",
  GROUP_NOT_FOUND: "Grup bulunamadı",
  JOB_NOT_FOUND: "İş bulunamadı",
  RESULT_PARSE_ERROR: "Sonuç ayrıştırılamadı",
} as const;
