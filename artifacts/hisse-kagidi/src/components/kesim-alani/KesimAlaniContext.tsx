import { createContext, useContext } from "react";
import type { useKesimAlaniState } from "./useKesimAlaniState";

export type KesimAlaniContextValue = ReturnType<typeof useKesimAlaniState>;

const KesimAlaniContext = createContext<KesimAlaniContextValue | null>(null);

export function KesimAlaniProvider({
  value,
  children,
}: {
  value: KesimAlaniContextValue;
  children: React.ReactNode;
}) {
  return (
    <KesimAlaniContext.Provider value={value}>
      {children}
    </KesimAlaniContext.Provider>
  );
}

export function useKesimAlaniContext(): KesimAlaniContextValue {
  const ctx = useContext(KesimAlaniContext);
  if (!ctx) throw new Error("useKesimAlaniContext must be used within KesimAlaniProvider");
  return ctx;
}
