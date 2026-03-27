import { Card } from "@/components/ui/card";
import { Bell, Edit3, ChevronRight } from "lucide-react";
import type { PendingEditRequest } from "@/lib/api";

interface PendingEditRequestsCardProps {
  pendingEditCount: number;
  pendingEditRequests: PendingEditRequest[];
  kesimAlanlari: { id: string }[];
  onNavigate: (path: string) => void;
}

export function PendingEditRequestsCard({
  pendingEditCount,
  pendingEditRequests,
  kesimAlanlari,
  onNavigate,
}: PendingEditRequestsCardProps) {
  if (pendingEditCount === 0) return null;

  return (
    <Card className="p-4 mb-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <Bell className="w-5 h-5 text-amber-600" />
          <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{pendingEditCount}</span>
        </div>
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Bekleyen Düzenleme Talepleri
        </h3>
      </div>
      <div className="space-y-1.5">
        {pendingEditRequests.slice(0, 5).map(req => {
          const fieldLabel = req.fieldName === "name" ? "Adına Kesilen" :
            req.fieldName === "description" ? "Vekaleti Veren" :
            req.fieldName === "donationType" ? "Cinsi" :
            req.fieldName === "vekalet" ? "Vekalet" :
            req.fieldName === "notes" ? "Notlar" : req.fieldName || "";
          return (
            <div
              key={req.id}
              className="flex items-center gap-2 p-2 rounded-md bg-amber-100/50 dark:bg-amber-900/30 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              onClick={() => {
                const ka = kesimAlanlari.find(k => k.id === req.kesimAlaniId);
                if (ka) onNavigate(`/kesim/${ka.id}`);
              }}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-amber-800 dark:text-amber-200 truncate">
                  {req.kesimAlaniName} — {req.content}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-amber-700/70 dark:text-amber-300/70">
                  <span className="font-medium">{fieldLabel}:</span>
                  <span className="line-through">{req.oldValue || "—"}</span>
                  <span>→</span>
                  <span className="font-medium">{req.newValue}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
          );
        })}
        {pendingEditCount > 5 && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center pt-1">
            ve {pendingEditCount - 5} talep daha...
          </p>
        )}
      </div>
    </Card>
  );
}
