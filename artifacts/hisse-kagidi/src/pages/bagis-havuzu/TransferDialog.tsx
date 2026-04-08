import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2 } from "lucide-react";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  transferTarget: string;
  setTransferTarget: (v: string) => void;
  newListName: string;
  setNewListName: (v: string) => void;
  creatingNewList: boolean;
  setCreatingNewList: (v: boolean) => void;
  transferring: boolean;
  onTransfer: () => void;
  kesimAlanlari: { id: string; name: string }[];
}

export function TransferDialog({
  open, onOpenChange, selectedCount, transferTarget, setTransferTarget,
  newListName, setNewListName, creatingNewList, setCreatingNewList,
  transferring, onTransfer, kesimAlanlari,
}: TransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kesim Listesine Aktar</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">{selectedCount} bağış aktarılacak.</p>
        <div className="space-y-3">
          <Select value={transferTarget} onValueChange={(v) => { setTransferTarget(v); setCreatingNewList(false); }}>
            <SelectTrigger><SelectValue placeholder="Mevcut kesim listesi seçin..." /></SelectTrigger>
            <SelectContent>
              {kesimAlanlari.map(ka => (
                <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            <span>veya</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Yeni kesim listesi adı..."
              value={newListName}
              onChange={(e) => { setNewListName(e.target.value); if (e.target.value) { setTransferTarget(""); setCreatingNewList(true); } else { setCreatingNewList(false); } }}
              className="h-9 flex-1"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); setNewListName(""); setCreatingNewList(false); }}>İptal</Button>
          <Button className="flex-1" onClick={onTransfer} disabled={(!transferTarget && !creatingNewList) || transferring || (creatingNewList && !newListName.trim())}>
            {transferring ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
            Aktar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
