import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle } from "lucide-react";

export function GroupFlagPopover({
  donationId,
  compact,
  onFlag,
}: {
  donationId: string;
  compact: boolean;
  onFlag: (id: string, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`${compact ? "h-4 w-4" : "h-5 w-5"} p-0 text-muted-foreground hover:text-amber-600`}
          title="Sorunlu işaretle"
          aria-label="Sorunlu işaretle"
        >
          <AlertTriangle className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium mb-1">Sorun açıklaması</p>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Neden sorunlu?"
          className="h-6 text-xs mb-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && reason.trim()) {
              onFlag(donationId, reason.trim());
              setOpen(false);
              setReason("");
            }
          }}
          autoFocus
        />
        <Button
          size="sm"
          className="w-full h-6 text-xs"
          disabled={!reason.trim()}
          onClick={() => {
            onFlag(donationId, reason.trim());
            setOpen(false);
            setReason("");
          }}
        >
          İşaretle
        </Button>
      </PopoverContent>
    </Popover>
  );
}
