import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  RotateCcw,
  Brain,
} from "lucide-react";
import { fetchAiSettings, saveAiSettings } from "@/lib/api";
import type { AiSettings } from "@/lib/api";

const DEFAULT_PROMPT = `Sen bir kurban/bağış yönetim sisteminin asistanısın. Sana verilen bağışçı notlarını analiz et ve her not için aşağıdaki kategorilerde sınıflandırma yap.

Notları analiz ederken:
1. Belirtilen kategorilere göre tespit et
2. Bağışçının cinsi (donationType) ile notları karşılaştır ve tutarsızlıkları bildir
3. Önemli istekler veya uyarılar varsa belirt

Kategoriler:
{{CATEGORIES}}

Her bağışçı için JSON formatında yanıt ver:
{
  "donationId": "...",
  "categories": ["kategori1", "kategori2"],
  "requests": "tespit edilen özel istekler",
  "warnings": "uyarılar ve tutarsızlıklar",
  "summary": "kısa özet"
}

Yanıtı JSON array olarak ver: [{...}, {...}]`;

const DEFAULT_CATEGORIES = [
  "sabah_kesimi",
  "ulke_talebi",
  "mevta_kurbani",
  "adak",
  "akika",
  "vacip",
  "nafile",
];

export default function AiPromptAyarlariPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AiSettings>({
    prompt: DEFAULT_PROMPT,
    categories: DEFAULT_CATEGORIES,
  });
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetchAiSettings()
      .then(s => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAiSettings(settings);
      toast({ title: "Kaydedildi", description: "AI ayarları başarıyla kaydedildi" });
    } catch (err) {
      toast({
        title: "Hata",
        description: err instanceof Error ? err.message : "Kaydetme hatası",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ prompt: DEFAULT_PROMPT, categories: DEFAULT_CATEGORIES });
    toast({ title: "Sıfırlandı", description: "Ayarlar varsayılan değerlere döndürüldü (kaydetmeyi unutmayın)" });
  };

  const addCategory = () => {
    const cat = newCategory.trim().replace(/\s+/g, "_").toLowerCase();
    if (!cat) return;
    if (settings.categories.includes(cat)) {
      toast({ title: "Zaten mevcut", description: "Bu kategori zaten eklenmiş" });
      return;
    }
    setSettings(prev => ({ ...prev, categories: [...prev.categories, cat] }));
    setNewCategory("");
  };

  const removeCategory = (cat: string) => {
    setSettings(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center gap-3 p-3">
          <Button variant="ghost" size="sm" onClick={() => history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              AI Prompt Ayarları
            </h1>
            <p className="text-xs text-muted-foreground">Not sınıflandırması için AI ayarları</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Sıfırla
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Kaydet
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <Card className="p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold mb-1">Sınıflandırma Kategorileri</h2>
            <p className="text-xs text-muted-foreground mb-3">
              AI'nın notlarda tespit edeceği kategoriler. Bu kategoriler prompt şablonuna otomatik eklenir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.categories.map(cat => (
              <div
                key={cat}
                className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20"
              >
                <span>{cat.replace(/_/g, " ")}</span>
                <button
                  className="text-primary/60 hover:text-destructive ml-1"
                  onClick={() => removeCategory(cat)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {settings.categories.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Kategori yok — eklemek için aşağıya girin</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Yeni kategori (ör: sabah_kesimi)"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addCategory}>
              <Plus className="w-4 h-4 mr-1" />
              Ekle
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Kategori adlarında boşluk yerine alt çizgi kullanın (ör: <code>sabah_kesimi</code>). Kategoriler prompt şablonuna virgülle ayrılmış şekilde eklenir.
          </p>
        </Card>

        <Card className="p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold mb-1">Prompt Şablonu</h2>
            <p className="text-xs text-muted-foreground mb-3">
              AI'ya gönderilecek sistem promptu. <code>{"{{CATEGORIES}}"}</code> ifadesi otomatik olarak kategoriler listesiyle değiştirilir.
            </p>
          </div>

          <Textarea
            value={settings.prompt}
            onChange={e => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
            className="font-mono text-xs min-h-[400px] resize-y"
            placeholder="Prompt şablonu..."
          />

          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Önemli notlar:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><code>{"{{CATEGORIES}}"}</code> kısmı kategoriler listesiyle değiştirilir</li>
              <li>AI'dan JSON array formatında yanıt beklenmektedir</li>
              <li>Her eleman: donationId, categories, requests, warnings, summary alanlarını içermeli</li>
              <li>Uyarılar cinsi/vekalet tutarsızlıklarını belirtmelidir</li>
            </ul>
          </div>
        </Card>

        <div className="bg-muted/50 border rounded-md p-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Örnek Uyarı Senaryoları</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>• Cinsi "Vacib" ama notta "merhume" yazıyor → Mevta kurbanı olabilir</p>
            <p>• Notta "adak" ifadesi var ama cinsi farklı → Kontrol edilmeli</p>
            <p>• Notta "sabah" veya "ilk bıçak" ifadesi → Sabah kesimi talebi</p>
            <p>• Notta ülke adı geçiyor → Belirli ülke talebi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
