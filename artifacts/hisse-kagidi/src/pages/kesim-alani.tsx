import { Suspense, lazy } from "react";
  import { useKesimAlaniState } from "@/components/kesim-alani/useKesimAlaniState";
  import { KesimAlaniContent } from "@/components/kesim-alani/KesimAlaniContent";

  const KesimAlaniDialogs = lazy(() =>
    import("@/components/kesim-alani/KesimAlaniDialogs").then(m => ({ default: m.KesimAlaniDialogs }))
  );

  export default function KesimAlaniPage() {
    const state = useKesimAlaniState();

    if (!state.kesim) return (
      <div className="min-h-screen bg-background p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
        <div className="h-10 bg-muted rounded w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );

    return (
      <>
        <KesimAlaniContent {...state} />
        <Suspense fallback={null}>
          <KesimAlaniDialogs {...state} />
        </Suspense>
      </>
    );
  }
  