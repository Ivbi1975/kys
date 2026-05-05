import { Skeleton } from "@/components/ui/skeleton";

export function KesimTakipSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#06111f" }}>
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b" style={{ borderColor: "rgba(148,163,184,0.10)" }}>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" style={{ background: "rgba(148,163,184,0.10)" }} />
            <Skeleton className="h-3 w-32" style={{ background: "rgba(148,163,184,0.08)" }} />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-14 rounded-xl" style={{ background: "rgba(148,163,184,0.08)" }} />
            <Skeleton className="h-9 w-28 rounded-xl" style={{ background: "rgba(148,163,184,0.08)" }} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border p-5 space-y-3" style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}>
                <Skeleton className="w-9 h-9 rounded-xl" style={{ background: "rgba(148,163,184,0.10)" }} />
                <div className="space-y-1.5">
                  <Skeleton className="h-8 w-16" style={{ background: "rgba(148,163,184,0.10)" }} />
                  <Skeleton className="h-3 w-24" style={{ background: "rgba(148,163,184,0.08)" }} />
                  <Skeleton className="h-2.5 w-20" style={{ background: "rgba(148,163,184,0.06)" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Table + Right panel */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
            {/* Table */}
            <div>
              <Skeleton className="h-14 w-full rounded-2xl mb-3" style={{ background: "#0b1a2b" }} />
              <div className="rounded-2xl border overflow-hidden" style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(148,163,184,0.08)" }}>
                  <div className="grid grid-cols-6 gap-4">
                    {["w-6", "w-16", "w-24", "w-20", "w-16", "w-14"].map((w, i) => (
                      <Skeleton key={i} className={`h-3 ${w}`} style={{ background: "rgba(148,163,184,0.10)" }} />
                    ))}
                  </div>
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="px-4 py-4 border-b" style={{ borderColor: "rgba(148,163,184,0.06)" }}>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-6" style={{ background: "rgba(148,163,184,0.08)" }} />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-24" style={{ background: "rgba(148,163,184,0.08)" }} />
                        <Skeleton className="h-3 w-16" style={{ background: "rgba(148,163,184,0.06)" }} />
                      </div>
                      <Skeleton className="h-3 w-32" style={{ background: "rgba(148,163,184,0.06)" }} />
                      <Skeleton className="h-6 w-16 rounded-lg" style={{ background: "rgba(148,163,184,0.08)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {[3, 4, 3].map((rows, pi) => (
                <div key={pi} className="rounded-2xl border p-5 space-y-3" style={{ background: "#0b1a2b", borderColor: "rgba(148,163,184,0.14)" }}>
                  <Skeleton className="h-3 w-28" style={{ background: "rgba(148,163,184,0.10)" }} />
                  {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-7 h-7 rounded-xl shrink-0" style={{ background: "rgba(148,163,184,0.08)" }} />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-32" style={{ background: "rgba(148,163,184,0.08)" }} />
                        <Skeleton className="h-2.5 w-24" style={{ background: "rgba(148,163,184,0.06)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
