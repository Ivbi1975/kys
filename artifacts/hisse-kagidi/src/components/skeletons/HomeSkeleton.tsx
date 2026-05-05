import { Skeleton } from "@/components/ui/skeleton";

const CARD = "#0d1c2e";
const BORDER = "rgba(255,255,255,0.07)";

export function HomeSkeleton() {
  return (
    <div style={{ background: "#07111f", minHeight: "100vh" }}>
      {/* Topbar skeleton */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="flex items-center gap-4 py-3.5">
            <Skeleton className="w-9 h-9 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }} />
            <Skeleton className="h-4 w-40 rounded" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }} />
              <Skeleton className="h-8 w-8 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }} />
              <Skeleton className="h-8 w-8 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-5 w-28 rounded mb-1.5" style={{ background: "rgba(255,255,255,0.07)" }} />
            <Skeleton className="h-3 w-44 rounded" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }} />
            <Skeleton className="h-9 w-40 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
        </div>

        <div className="space-y-3">
          {[1, 2].map(i => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <Skeleton className="w-9 h-9 rounded-xl shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-36 rounded mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
            <Skeleton className="h-3 w-14 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
            <Skeleton className="h-3 w-14 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
        </div>
        <Skeleton className="w-4 h-4 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, padding: "12px 20px" }}>
        <div className="flex items-center justify-between mb-1.5">
          <Skeleton className="h-2.5 w-20 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
          <Skeleton className="h-2.5 w-16 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
        <Skeleton className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
    </div>
  );
}
