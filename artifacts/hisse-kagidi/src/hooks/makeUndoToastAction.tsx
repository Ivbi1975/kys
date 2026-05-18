import { ToastAction } from "@/components/ui/toast";
import type { ToastActionElement } from "@/components/ui/toast";

export function makeUndoToastAction(onClick: () => Promise<void>): ToastActionElement {
  return (
    <ToastAction altText="Geri Al" onClick={onClick}>Geri Al</ToastAction>
  );
}
