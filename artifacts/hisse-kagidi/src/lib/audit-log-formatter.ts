import type { AuditLogEntry } from "@/lib/api/audit-logs";

export function isBulkDelete(entry: AuditLogEntry): boolean {
  if (entry.action === "bulk_action" && entry.entityType === "donation") {
    const m = entry.metadata as Record<string, unknown> | null;
    const action = m?.action ?? m?.bulkActionType;
    if (action === "delete") return true;
  }
  if (entry.action === "delete" && entry.entityType === "donation" && (entry.affectedCount ?? 0) > 1) {
    return true;
  }
  return false;
}

export function formatFiltersText(filters: unknown): string[] {
  if (!filters || typeof filters !== "object") return [];
  const f = filters as Record<string, unknown>;
  const parts: string[] = [];
  const label = (val: unknown): string =>
    Array.isArray(val) ? (val as unknown[]).filter(Boolean).join(", ") : String(val);
  const hasValue = (val: unknown): boolean =>
    val != null && val !== "" && (!Array.isArray(val) || (val as unknown[]).length > 0);

  if (hasValue(f.search)) parts.push(`Arama: "${f.search}"`);
  if (hasValue(f.status)) parts.push(`Durum: ${f.status}`);
  if (hasValue(f.donationType)) parts.push(`Tür: ${label(f.donationType)}`);
  if (hasValue(f.birim)) parts.push(`Birim: ${label(f.birim)}`);
  if (hasValue(f.temsilci)) parts.push(`Temsilci: ${label(f.temsilci)}`);
  if (hasValue(f.kesimAlaniId)) parts.push(`KA: ${f.kesimAlaniId}`);
  if (hasValue(f.ozellik)) parts.push(`Özellik: ${label(f.ozellik)}`);
  if (hasValue(f.fiyat)) parts.push(`Fiyat: ${label(f.fiyat)}`);
  if (hasValue(f.yerTalebi)) parts.push(`Yer: ${label(f.yerTalebi)}`);
  if (hasValue(f.gunTalebi)) parts.push(`Gün: ${label(f.gunTalebi)}`);
  if (hasValue(f.ilkHayvan)) parts.push(`Hayvan: ${label(f.ilkHayvan)}`);
  if (hasValue(f.safi)) parts.push(`Safi: ${label(f.safi)}`);
  if (hasValue(f.flagFilter)) parts.push(`Bayrak: ${f.flagFilter}`);
  if (hasValue(f.notesFilter)) parts.push(`Not: ${f.notesFilter}`);
  if (hasValue(f.aiCategory)) parts.push(`AI: ${label(f.aiCategory)}`);
  if (hasValue(f.tagIds)) parts.push(`Etiket: ${label(f.tagIds)}`);
  if (hasValue(f.dateFrom) || hasValue(f.dateTo)) {
    const from = f.dateFrom ?? "";
    const to = f.dateTo ?? "";
    parts.push(`Tarih: ${from}${from && to ? " – " : ""}${to}`);
  }
  if (hasValue(f.shareCountMin) || hasValue(f.shareCountMax)) {
    const min = f.shareCountMin ?? "";
    const max = f.shareCountMax ?? "";
    parts.push(`Hisse: ${min}${min && max ? "–" : ""}${max}`);
  }
  return parts;
}

function meta(entry: AuditLogEntry): Record<string, unknown> {
  if (entry.metadata && typeof entry.metadata === "object") {
    return entry.metadata as Record<string, unknown>;
  }
  return {};
}

function str(val: unknown): string {
  if (typeof val === "string" && val.trim()) return val.trim();
  return "";
}

function count(entry: AuditLogEntry): number {
  return typeof entry.affectedCount === "number" ? entry.affectedCount : 0;
}

function entityLabel(entityType: string): string {
  const map: Record<string, string> = {
    donation: "bağışçı",
    animal_group: "hayvan grubu",
    project: "proje",
    kesim_alani: "kesim alanı",
    settings: "ayar",
    backup: "yedek",
    pool: "havuz",
  };
  return map[entityType] || entityType;
}

function entityLabelPlural(entityType: string): string {
  const map: Record<string, string> = {
    donation: "bağış",
    animal_group: "hayvan grubu",
    project: "proje",
    kesim_alani: "kesim alanı",
    settings: "ayar",
    backup: "yedek",
    pool: "havuz",
  };
  return map[entityType] || entityType;
}

function namedEntity(entry: AuditLogEntry): string {
  if (entry.entityName) return `"${entry.entityName}"`;
  return entityLabel(entry.entityType);
}

export function formatAuditLogDescription(entry: AuditLogEntry): string {
  const m = meta(entry);
  const n = count(entry);
  const entityName = entry.entityName ? `"${entry.entityName}"` : "";
  const targetKA = str(m.targetKesimAlaniName) || str(entry.targetKesimAlaniId ? `KA:${entry.targetKesimAlaniId}` : "");
  const sourceKA = str(m.sourceKesimAlaniName);
  const kaName = str(m.kesimAlaniName);

  switch (entry.action) {
    case "create":
      if (entry.entityType === "kesim_alani") {
        return entityName ? `${entityName} kesim alanı oluşturuldu` : "Yeni kesim alanı oluşturuldu";
      }
      if (entry.entityType === "project") {
        return entityName ? `${entityName} projesi oluşturuldu` : "Yeni proje oluşturuldu";
      }
      if (entry.entityType === "animal_group") {
        const no = m.animalNo ? ` (#${m.animalNo})` : "";
        return `Hayvan grubu${no} oluşturuldu${kaName ? ` — ${kaName}` : ""}`;
      }
      return entityName
        ? `${entityName} ${entityLabel(entry.entityType)} kaydı oluşturuldu`
        : `Yeni ${entityLabel(entry.entityType)} kaydı oluşturuldu`;

    case "update":
      if (entry.entityType === "animal_group") {
        const no = m.animalNo ? ` #${m.animalNo}` : "";
        return `Hayvan grubu${no} güncellendi${kaName ? ` — ${kaName}` : ""}`;
      }
      return entityName
        ? `${entityName} güncellendi`
        : `${entityLabel(entry.entityType)} kaydı güncellendi`;

    case "delete":
      if (n > 1) return `${n} ${entityLabelPlural(entry.entityType)} silindi`;
      return entityName
        ? `${entityName} silindi`
        : `${entityLabel(entry.entityType)} kaydı silindi`;

    case "restore":
      if (n > 1) return `${n} ${entityLabelPlural(entry.entityType)} geri yüklendi`;
      return entityName ? `${entityName} geri yüklendi` : `${entityLabel(entry.entityType)} geri yüklendi`;

    case "archive":
      return entityName ? `${entityName} arşivlendi` : `${entityLabel(entry.entityType)} arşivlendi`;

    case "unarchive":
      return entityName ? `${entityName} arşivden çıkarıldı` : `${entityLabel(entry.entityType)} arşivden çıkarıldı`;

    case "toggle_kesildi": {
      const no = m.animalNo ? ` #${m.animalNo}` : "";
      const newVal = m.kesildi;
      const status = newVal === true ? "kesildi olarak işaretlendi" : newVal === false ? "kesilmedi olarak geri alındı" : "kesildi durumu değiştirildi";
      return `Hayvan grubu${no} ${status}${kaName ? ` — ${kaName}` : ""}`;
    }

    case "split":
      if (entry.entityType === "kesim_alani") {
        const child = str(m.childName);
        return `${entityName || "Kesim alanı"} bölündü${child ? ` → ${child}` : ""}`;
      }
      return entityName ? `${entityName} bölündü` : `${entityLabel(entry.entityType)} bölündü`;

    case "merge":
      return entityName ? `${entityName} birleştirildi` : `${entityLabel(entry.entityType)} birleştirildi`;

    case "lock": {
      const no = m.animalNo ? ` #${m.animalNo}` : "";
      if (entry.entityType === "animal_group") return `Hayvan grubu${no} kilitlendi${kaName ? ` — ${kaName}` : ""}`;
      return entityName ? `${entityName} kilitlendi` : `${entityLabel(entry.entityType)} kilitlendi`;
    }

    case "unlock": {
      const no = m.animalNo ? ` #${m.animalNo}` : "";
      if (entry.entityType === "animal_group") return `Hayvan grubu${no} kilidi açıldı${kaName ? ` — ${kaName}` : ""}`;
      return entityName ? `${entityName} kilidi açıldı` : `${entityLabel(entry.entityType)} kilidi açıldı`;
    }

    case "import":
      if (n > 0) return `${n} ${entityLabelPlural(entry.entityType)} içe aktarıldı${kaName ? ` — ${kaName}` : ""}`;
      return `${entityLabel(entry.entityType)} verileri içe aktarıldı`;

    case "bulk_import":
      if (n > 0) return `${n} ${entityLabelPlural(entry.entityType)} toplu içe aktarıldı${kaName ? ` — ${kaName}` : ""}`;
      return `Toplu içe aktarma gerçekleştirildi`;

    case "export":
      return `${entityLabel(entry.entityType)} verileri dışa aktarıldı`;

    case "repair":
      if (n > 0) return `${n} kayıt onarıldı`;
      return `${entityLabel(entry.entityType)} verileri onarıldı`;

    case "move":
      if (n > 1) {
        return targetKA
          ? `${n} ${entityLabelPlural(entry.entityType)} ${targetKA} alanına taşındı`
          : `${n} ${entityLabelPlural(entry.entityType)} taşındı`;
      }
      return targetKA
        ? `${namedEntity(entry)} ${targetKA} alanına taşındı`
        : `${namedEntity(entry)} taşındı`;

    case "transfer":
      if (n > 0) {
        if (sourceKA && targetKA) return `${n} bağış ${sourceKA}'dan ${targetKA}'ya aktarıldı`;
        if (targetKA) return `${n} bağış ${targetKA}'ya aktarıldı`;
        return `${n} bağış aktarıldı`;
      }
      if (sourceKA && targetKA) {
        return entityName
          ? `${entityName} ${sourceKA}'dan ${targetKA}'ya aktarıldı`
          : `Bağış ${sourceKA}'dan ${targetKA}'ya aktarıldı`;
      }
      return targetKA
        ? `${entityName || "Bağış"} ${targetKA}'ya aktarıldı`
        : `${entityName || "Bağış"} aktarıldı`;

    case "bulk_transfer": {
      const c = n || (m.count as number) || 0;
      if (sourceKA && targetKA) return `${c > 0 ? `${c} bağış` : "Bağışlar"} ${sourceKA}'dan ${targetKA}'ya toplu aktarıldı`;
      if (targetKA) return `${c > 0 ? `${c} bağış` : "Bağışlar"} ${targetKA}'ya toplu aktarıldı`;
      return `${c > 0 ? `${c} bağış` : "Bağışlar"} toplu aktarıldı`;
    }

    case "bulk_create":
      if (n > 0) return `${n} ${entityLabelPlural(entry.entityType)} toplu oluşturuldu${kaName ? ` — ${kaName}` : ""}`;
      return `Toplu kayıt oluşturuldu`;

    case "bulk_action": {
      const actionDetail = str(m.bulkActionType) || str(m.action) || str(m.field);
      const c = n || 0;
      if (actionDetail === "delete") return `${c > 0 ? `${c} ` : ""}${entityLabelPlural(entry.entityType)} toplu silindi`;
      if (actionDetail === "restore") return `${c > 0 ? `${c} ` : ""}${entityLabelPlural(entry.entityType)} toplu geri yüklendi`;
      if (actionDetail === "tag") return `${c > 0 ? `${c} ` : ""}kayda etiket eklendi`;
      if (actionDetail === "note") return `${c > 0 ? `${c} ` : ""}kayda not güncellendi`;
      if (actionDetail === "updateField" || actionDetail === "update") {
        const fieldName = str(m.field) || str(m.fieldLabel);
        return `${c > 0 ? `${c} ` : ""}${entityLabelPlural(entry.entityType)}${fieldName ? ` — ${fieldName}` : ""} toplu güncellendi`;
      }
      return `${c > 0 ? `${c} ` : ""}${entityLabelPlural(entry.entityType)} toplu işleme alındı`;
    }

    case "filter_apply": {
      const filterCount = m.filterCount as number | undefined;
      return filterCount != null && filterCount > 0
        ? `Havuzda ${filterCount} filtre uygulandı`
        : "Havuzda filtre uygulandı";
    }

    default:
      return entityName
        ? `${entityName} üzerinde işlem gerçekleştirildi`
        : `${entityLabel(entry.entityType)} üzerinde işlem gerçekleştirildi`;
  }
}
