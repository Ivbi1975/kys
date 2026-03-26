import { useKesimAlaniState } from "@/components/kesim-alani/useKesimAlaniState";
import { KesimAlaniContent } from "@/components/kesim-alani/KesimAlaniContent";
import { KesimAlaniDialogs } from "@/components/kesim-alani/KesimAlaniDialogs";

export default function KesimAlaniPage() {
  const state = useKesimAlaniState();

  return (
    <>
      <KesimAlaniContent {...state} />
      <KesimAlaniDialogs {...state} />
    </>
  );
}
