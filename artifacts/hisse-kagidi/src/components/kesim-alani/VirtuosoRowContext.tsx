import { createContext, useContext } from "react";

interface VirtuosoRowContextValue {
  rowAttrs: Record<string, unknown>;
  rowClassName: string;
}

export const VirtuosoRowContext = createContext<VirtuosoRowContextValue>({
  rowAttrs: {},
  rowClassName: "",
});

export function useVirtuosoRowContext() {
  return useContext(VirtuosoRowContext);
}
