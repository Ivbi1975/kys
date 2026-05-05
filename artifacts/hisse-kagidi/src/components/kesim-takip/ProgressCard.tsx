import { FileText } from "lucide-react";

interface ProgressCardProps {
  kesildiCount: number;
  totalGroups: number;
  onShowReport: () => void;
}

export function ProgressCard({ kesildiCount, totalGroups, onShowReport }: ProgressCardProps) {
  const progressPercent = totalGroups > 0 ? Math.round((kesildiCount / totalGroups) * 100) : 0;
  const remaining = totalGroups - kesildiCount;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 mb-3">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-0.5">Kesim Durumu</p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-4xl font-bold text-teal-600 tabular-nums"
              aria-live="polite"
              aria-label={`${kesildiCount} hayvan kesildi`}
            >
              {kesildiCount}
            </span>
            <span className="text-lg text-stone-300 font-light">/</span>
            <span className="text-xl font-semibold text-stone-500">{totalGroups}</span>
          </div>
        </div>

        <div className="text-right space-y-0.5">
          <p className="text-xs text-stone-400">Kalan</p>
          <p className="text-2xl font-bold text-amber-500 tabular-nums">{remaining}</p>
        </div>
      </div>

      <div
        className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden mb-3"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Kesim ilerlemesi: %${progressPercent}`}
      >
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(progressPercent, kesildiCount > 0 ? 2 : 0)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-400">
          %{progressPercent} tamamlandı
        </span>
        <button
          onClick={onShowReport}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-teal-600 transition-colors font-medium"
          aria-label="Durum raporunu görüntüle"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          Durum Raporu
        </button>
      </div>
    </div>
  );
}
