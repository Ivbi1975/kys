import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function ProjeDetaySkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-16 rounded-md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        <Card className="p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-full rounded-full mt-4" />
        </Card>

        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <KesimAlaniCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KesimAlaniCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-36 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(k => (
          <div key={k} className="text-center">
            <Skeleton className="h-6 w-8 mx-auto mb-1" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}
