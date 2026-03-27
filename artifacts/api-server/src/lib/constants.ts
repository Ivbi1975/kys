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
  TARGET_PROJECT_NOT_FOUND: "Hedef proje bulunamadı",
  ALREADY_ACTIVE: "Bu kesim alanı zaten aktif",
  INVALID_CURSOR: "Geçersiz cursor",
  ANIMAL_GROUP_NOT_FOUND: "Hayvan grubu bulunamadı",
  GROUP_IDS_OR_FILTER_REQUIRED: "groupIds veya filter gerekli",
  DONOR_NOT_FOUND: "Bağışçı bulunamadı",
  DONOR_ALREADY_ACTIVE: "Bu bağışçı zaten aktif",
  SAME_SOURCE_TARGET: "Kaynak ve hedef kesim alanı aynı olamaz",
  SOURCE_KESIM_NOT_FOUND: "Kaynak kesim alanı bulunamadı",
  SOURCE_KESIM_NOT_FOUND_OR_DELETED: "Kaynak kesim alanı bulunamadı veya silinmiş",
  TARGET_KESIM_NOT_FOUND: "Hedef kesim alanı bulunamadı",
  TARGET_KESIM_NOT_FOUND_OR_DELETED: "Hedef kesim alanı bulunamadı veya silinmiş",
  DONOR_NOT_IN_SOURCE: "Bağışçı bulunamadı veya kaynak kesim alanına ait değil",
  MUST_BE_SAME_PROJECT: "Kaynak ve hedef kesim alanları aynı projede olmalıdır",
  NO_VALID_DONORS: "Aktarılacak geçerli bağışçı bulunamadı",
  TRACKING_LINK_NOT_FOUND: "Takip linki bulunamadı",
  SINCE_PARAM_REQUIRED: "since parametresi gerekli",
  INVALID_SINCE_DATE: "Geçersiz since tarihi",
  INVALID_ANIMAL_GROUP: "Geçersiz hayvan grubu",
  PHOTO_NOT_FOUND: "Fotoğraf bulunamadı",
  PHOTO_TOO_LARGE: "Fotoğraf çok büyük (max 5MB)",
  ADMIN_KEY_NOT_SET: "ADMIN_KEY ortam değişkeni ayarlanmamış",
  UNAUTHORIZED: "Yetkisiz erişim",
  TEAM_NOT_FOUND: "Ekip bulunamadı",
} as const;

export const NOTE_WARNING_KEYWORDS = [
  "iade", "iptal", "hata", "yanlış", "sorun", "problem",
  "dikkat", "uyarı", "eksik", "hatalı", "değiştirilecek",
] as const;
