import { lazy } from "react";
  import { useKesimAlaniState } from "@/components/kesim-alani/useKesimAlaniState";
  import { KesimAlaniContent } from "@/components/kesim-alani/KesimAlaniContent";
  import { LazyLoadBoundary } from "@/components/LazyLoadBoundary";
  import { KesimAlaniSkeleton } from "@/components/skeletons/KesimAlaniSkeleton";
  import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";

  const KesimAlaniDialogs = lazy(() =>
    import("@/components/kesim-alani/KesimAlaniDialogs").then(m => ({ default: m.KesimAlaniDialogs }))
  );

  export default function KesimAlaniPage() {
    const state = useKesimAlaniState();
    const showSkeleton = useMinLoadingTime(!state.kesim);

    if (showSkeleton) return <KesimAlaniSkeleton />;

    return (
      <>
        <KesimAlaniContent {...state} />
        <LazyLoadBoundary>
          <KesimAlaniDialogs {...state} />
        </LazyLoadBoundary>
      </>
    );
  }
  