import { useState, useEffect, useRef } from "react";

export function useMinLoadingTime(isLoading: boolean, minMs = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const loadStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setShowSkeleton(true);
    } else if (loadStartRef.current !== null) {
      const elapsed = Date.now() - loadStartRef.current;
      const remaining = minMs - elapsed;
      if (remaining > 0) {
        const timer = setTimeout(() => setShowSkeleton(false), remaining);
        return () => clearTimeout(timer);
      } else {
        setShowSkeleton(false);
      }
      loadStartRef.current = null;
    } else {
      setShowSkeleton(false);
    }
  }, [isLoading, minMs]);

  return showSkeleton;
}