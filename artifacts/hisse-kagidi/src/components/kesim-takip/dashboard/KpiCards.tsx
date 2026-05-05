import { Beef, CheckCircle2, Clock, TrendingUp } from "lucide-react";

interface KpiCardsProps {
  total: number;
  done: number;
  pending: number;
}

export function KpiCards({ total, done, pending }: KpiCardsProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const cards = [
    {
      label: "Toplam Hayvan",
      value: total,
      sub: "Bu proje toplamı",
      icon: Beef,
      iconColor: "#94a3b8",
      iconBg: "rgba(148,163,184,0.12)",
    },
    {
      label: "Kesilen",
      value: done,
      sub: "Bu proje toplamı",
      icon: CheckCircle2,
      iconColor: "#00c986",
      iconBg: "rgba(0,201,134,0.14)",
    },
    {
      label: "Bekleyen",
      value: pending,
      sub: "İşlem bekleyen",
      icon: Clock,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.14)",
    },
    {
      label: "Tamamlanma",
      value: `%${pct}`,
      sub: `${done} / ${total} tamamlandı`,
      icon: TrendingUp,
      iconColor: "#3b82f6",
      iconBg: "rgba(59,130,246,0.14)",
      isRate: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(({ label, value, sub, icon: Icon, iconColor, iconBg, isRate }) => (
        <div
          key={label}
          className="rounded-2xl p-5 flex flex-col gap-3 border transition-all hover:border-white/20"
          style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}
        >
          <div className="flex items-start justify-between">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: iconBg }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} aria-hidden="true" />
            </div>
          </div>
          <div>
            <p
              className={`font-bold tabular-nums leading-none mb-1 ${isRate ? "text-2xl" : "text-3xl"}`}
              style={{ color: "#f8fafc" }}
              aria-live="polite"
            >
              {value}
            </p>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#cbd5e1" }}>{label}</p>
            <p className="text-[11px]" style={{ color: "#94a3b8" }}>{sub}</p>
          </div>
          {isRate && (
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 4, background: "rgba(148,163,184,0.12)" }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tamamlanma oranı: %${pct}`}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(pct, done > 0 ? 2 : 0)}%`, background: "#3b82f6" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
