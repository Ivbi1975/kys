import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <img src="/kurban-logo.png" alt="Kurban Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0 object-cover" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>

        <div className="space-y-4">
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2].map(j => (
          <KesimAlaniCardSkeleton key={j} />
        ))}
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