import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function KesimTakipSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-background">
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center mb-6 pt-4">
          <Skeleton className="w-10 h-10 rounded-full mx-auto mb-2" />
          <Skeleton className="h-6 w-48 mx-auto mb-1" />
          <Skeleton className="h-4 w-32 mx-auto mb-1" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>

        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex items-center justify-between mt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
        </Card>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupCardSkeleton() {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md shrink-0" />
      </div>
    </Card>
  );
}