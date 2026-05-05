import { ChevronRight, Trash2, Calendar, Link2, ExternalLink, QrCode, MoveRight, Pencil } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { getTotalShares, getRequiredAnimals } from "@/lib/grouping";
import { formatDate, timeSince } from "@/lib/formatting";

const CARD = "#0d1c2e";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#f8fafc";
const MUTED = "#6f8097";
const SEC = "#aab8cc";

interface KesimCardProps {
  kesimAlani: KesimAlani;
  onNavigate: (id: string) => void;
  onCopyTrackingLink: (e: React.MouseEvent, k: KesimAlani) => void;
  onOpenTrackingPage: (e: React.MouseEvent, k: KesimAlani) => void;
  onShowQrCode: (e: React.MouseEvent, k: KesimAlani) => void;
  onMove: (k: KesimAlani) => void;
  onDelete: (id: string) => void;
  onRename?: (k: KesimAlani) => void;
}

export function KesimCard({
  kesimAlani: k,
  onNavigate,
  onCopyTrackingLink,
  onOpenTrackingPage,
  onShowQrCode,
  onMove,
  onDelete,
  onRename,
}: KesimCardProps) {
  const shares = getTotalShares(k.donations);
  const animals = getRequiredAnimals(k.donations);
  const activeDonors = k.donations.filter(d => !d.excluded).length;
  const totalSlots = k.animalGroups.length * 7;
  const filledSlots = k.animalGroups.reduce(
    (s, g) => s + g.donations.filter(d => d.name.trim() !== "").length, 0
  );
  const occupancy = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const kesildiCount = k.animalGroups.filter(g => g.kesildi).length;
  const totalGroups = k.animalGroups.length;
  const kesildiPercent = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;
  const lastKesildiAt = k.animalGroups
    .filter(g => g.kesildiAt)
    .map(g => g.kesildiAt!)
    .sort()
    .pop();

  const progressColor = kesildiPercent === 100 ? "#22c55e" : "#3b82f6";

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: (e: React.MouseEvent) => void,
    danger = false
  ) => (
    <button
      title={label}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onClick(e); }}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
      style={{
        color: danger ? "#ef4444" : MUTED,
        background: "transparent",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => onNavigate(k.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onNavigate(k.id)}
        aria-label={`${k.name} kesim alanına git`}
      >
        {/* Title + date */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate" style={{ color: TEXT }}>{k.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3 shrink-0" style={{ color: MUTED }} aria-hidden="true" />
            <span className="text-xs" style={{ color: MUTED }}>
              {formatDate(k.createdAt)}
              <span className="ml-1.5 opacity-60">({timeSince(k.createdAt)})</span>
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
          {iconBtn("Takip linkini kopyala", <Link2 className="w-3.5 h-3.5" />, e => onCopyTrackingLink(e, k))}
          {iconBtn("Takip sayfasını aç", <ExternalLink className="w-3.5 h-3.5" />, e => onOpenTrackingPage(e, k))}
          {iconBtn("QR Kod", <QrCode className="w-3.5 h-3.5" />, e => onShowQrCode(e, k))}
          {onRename && iconBtn("Yeniden adlandır", <Pencil className="w-3.5 h-3.5" />, () => onRename(k))}
          {iconBtn("Taşı", <MoveRight className="w-3.5 h-3.5" />, () => onMove(k))}
          {iconBtn("Sil", <Trash2 className="w-3.5 h-3.5" />, () => onDelete(k.id), true)}
        </div>

        <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: MUTED }} />
      </div>

      {/* Stats grid */}
      <div
        className="grid grid-cols-5 border-t"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        {[
          { val: `${activeDonors}${k.maxVekalet ? `/${k.maxVekalet}` : ""}`, label: "Bağışçı" },
          { val: shares, label: "Hisse" },
          { val: `${animals}${k.maxAnimal ? `/${k.maxAnimal}` : ""}`, label: "Hayvan" },
          { val: k.animalGroups.length, label: "Grup" },
          { val: `%${occupancy}`, label: "Doluluk" },
        ].map(({ val, label }, i) => (
          <div
            key={label}
            className="flex flex-col items-center py-3 text-center"
            style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
          >
            <span className="text-sm font-bold tabular-nums" style={{ color: "#3b82f6" }}>{val}</span>
            <span className="text-[10px] mt-0.5" style={{ color: MUTED }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Kesim progress */}
      {totalGroups > 0 && (
        <div
          className="px-5 py-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: MUTED }}>Kesim Durumu</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: kesildiPercent === 100 ? "#22c55e" : TEXT }}>
                {kesildiCount}/{totalGroups}
              </span>
              {lastKesildiAt && (
                <span className="text-[10px]" style={{ color: MUTED }}>
                  son: {new Date(lastKesildiAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${kesildiPercent}%`, background: progressColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
