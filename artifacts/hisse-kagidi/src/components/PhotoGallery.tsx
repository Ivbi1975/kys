import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Loader2, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupPhoto } from "@/lib/api";

function LazyImage({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} onClick={onClick}>
      {visible ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted/60 animate-pulse rounded backdrop-blur-sm flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground/30 animate-pulse" />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            loading="lazy"
            decoding="async"
          />
        </>
      ) : (
        <div className="w-full h-full bg-muted/60 backdrop-blur-sm flex items-center justify-center rounded">
          <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

const MAX_PHOTOS = 5;

function compressImage(file: File, maxWidth = 1200): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context error")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ data, mimeType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Image load error"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

interface PhotoGalleryProps {
  photos: GroupPhoto[];
  getPhotoUrl: (photoId: string, size?: "thumb") => string;
  onUpload?: (data: string, mimeType: string) => Promise<GroupPhoto>;
  onDelete?: (photoId: string) => Promise<void>;
  readOnly?: boolean;
}

export default function PhotoGallery({ photos, getPhotoUrl, onUpload, onDelete, readOnly = false }: PhotoGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const { data, mimeType } = await compressImage(file);
      await onUpload(data, mimeType);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleDelete = useCallback(async (photoId: string) => {
    if (!onDelete) return;
    setDeleting(photoId);
    try {
      await onDelete(photoId);
    } catch (err) {
      console.error("Photo delete failed:", err);
    } finally {
      setDeleting(null);
    }
  }, [onDelete]);

  const canAdd = !readOnly && photos.length < MAX_PHOTOS;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted cursor-pointer">
            <LazyImage
              src={getPhotoUrl(photo.id, "thumb")}
              alt=""
              className="w-full h-full relative"
              onClick={() => setLightboxId(photo.id)}
            />
            {!readOnly && onDelete && (
              <button
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                disabled={deleting === photo.id}
              >
                {deleting === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        )}

        {!readOnly && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        )}
      </div>

      {photos.length === 0 && readOnly && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Fotoğraf yok</span>
        </div>
      )}

      {lightboxId && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxId(null)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10 p-0 z-10"
            onClick={() => setLightboxId(null)}
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="flex items-center gap-2 absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            {photos.map((p) => (
              <button
                key={p.id}
                className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${
                  p.id === lightboxId ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                onClick={(e) => { e.stopPropagation(); setLightboxId(p.id); }}
              >
                <img src={getPhotoUrl(p.id, "thumb")} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <img
            src={getPhotoUrl(lightboxId)}
            alt=""
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function PhotoButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      onClick={onClick}
    >
      <Camera className="w-3.5 h-3.5" />
      {count > 0 && <span className="bg-primary/10 text-primary px-1.5 rounded-full text-[10px] font-semibold">{count}</span>}
    </Button>
  );
}
