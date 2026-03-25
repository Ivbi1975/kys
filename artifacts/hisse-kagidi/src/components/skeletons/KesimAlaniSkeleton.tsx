import { Skeleton } from "@/components/ui/skeleton";

export function KesimAlaniSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      <TableSkeleton rows={8} />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 flex gap-4">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-32 flex-1" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="px-4 py-3 flex gap-4 border-t">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" style={{ width: `${60 + Math.random() * 30}%` }} />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}