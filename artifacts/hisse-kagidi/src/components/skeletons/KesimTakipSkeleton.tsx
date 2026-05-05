import { Skeleton } from "@/components/ui/skeleton";

export function KesimTakipSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="sticky top-0 z-30 bg-white border-b border-stone-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-14 rounded-full" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <Skeleton className="h-3 w-24 mb-2" />
          <div className="flex items-end justify-between mb-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full mb-3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="flex gap-1.5">
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>

        <div className="space-y-2">
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
    <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8 rounded-md" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
      </div>
    </div>
  );
}
