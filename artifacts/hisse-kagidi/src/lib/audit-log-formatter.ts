import type { AuditLogEntry } from "@/lib/api/audit-logs";

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
      const actionDetail = str(m.bulkActionType) || str(m.field);
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
