import { useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";

interface QrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export default function QrCodeModal({ open, onOpenChange, url, title }: QrCodeModalProps) {
  const svgRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current.querySelector("svg");
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const padding = 40;
      const textHeight = 60;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, padding, padding);

      ctx.fillStyle = "#374151";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";

      const maxWidth = canvas.width - padding * 2;
      const displayUrl = url.length > 60 ? url.slice(0, 57) + "..." : url;
      ctx.fillText(displayUrl, canvas.width / 2, img.height + padding + 30);

      if (title) {
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#111827";
        ctx.fillText(title, canvas.width / 2, img.height + padding + 50);
      }

      const link = document.createElement("a");
      link.download = `qr-kod-${title?.replace(/\s+/g, "-") || "takip"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [url, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Kod
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div ref={svgRef} className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={url}
              size={220}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="text-xs text-muted-foreground text-center break-all max-w-[260px] select-all">
            {url}
          </div>
          {title && (
            <div className="text-sm font-medium text-center">{title}</div>
          )}
          <Button onClick={handleDownload} className="w-full" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            PNG İndir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
