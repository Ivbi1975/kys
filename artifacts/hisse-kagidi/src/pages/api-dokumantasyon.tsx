import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Server, Lock, Zap, ChevronDown, ChevronRight,
  Copy, Check, Globe, ShieldCheck, AlertCircle
} from "lucide-react";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  };
  return { copied, copy };
}

function CodeBlock({ code, id }: { code: string; id: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="relative group rounded-lg bg-[hsl(224,50%,7%)] border border-white/8 overflow-hidden">
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-white/8 hover:bg-white/14 text-white/50 hover:text-white/80"
      >
        {copied === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="text-[12.5px] text-white/75 p-4 overflow-x-auto leading-relaxed font-mono">{code}</pre>
    </div>
  );
}

function FieldTable({ rows }: { rows: { alan: string; tur: string; aciklama: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/8">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-white/4 border-b border-white/8">
            <th className="text-left px-4 py-2.5 text-white/50 font-semibold">Alan</th>
            <th className="text-left px-4 py-2.5 text-white/50 font-semibold">Tür</th>
            <th className="text-left px-4 py-2.5 text-white/50 font-semibold">Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/2">
              <td className="px-4 py-2.5 font-mono text-primary/80">{r.alan}</td>
              <td className="px-4 py-2.5 text-white/40">{r.tur}</td>
              <td className="px-4 py-2.5 text-white/60">{r.aciklama}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id, title, method, path, description, children
}: {
  id: string; title: string; method?: string; path?: string;
  description: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white/3 hover:bg-white/5 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {method && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              {method}
            </span>
          )}
          <span className="font-semibold text-white/85 text-[14px]">{title}</span>
          {path && <span className="font-mono text-[12px] text-white/35 truncate">{path}</span>}
        </div>
      </button>
      {open && (
        <div className="px-5 py-4 space-y-4 border-t border-white/5">
          <p className="text-[13px] text-white/55 leading-relaxed">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
}

const BASE_URL = "https://<sunucu>/api/vys";

export default function ApiDokumantasyon() {
  return (
    <div className="min-h-screen bg-[hsl(224,50%,6%)] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Başlık */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VYS API Dokümantasyonu</h1>
              <p className="text-[12px] text-white/35">KYS → VYS salt-okunur entegrasyon arayüzü</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/8 text-[11px]">
              Salt Okunur
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/8 text-[11px]">
              REST / JSON
            </Badge>
            <Badge variant="outline" className="text-white/40 border-white/15 text-[11px]">
              v1
            </Badge>
          </div>
        </div>

        {/* Temel Bilgiler */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/8 bg-white/2 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 text-white/35 text-[11px]">
              <Globe className="h-3.5 w-3.5" /> Temel URL
            </div>
            <p className="font-mono text-[12px] text-white/70">/api/vys</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/2 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 text-white/35 text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5" /> Kimlik Doğrulama
            </div>
            <p className="font-mono text-[12px] text-white/70">X-API-Key header</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/2 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 text-white/35 text-[11px]">
              <Zap className="h-3.5 w-3.5" /> Hız Sınırı
            </div>
            <p className="font-mono text-[12px] text-white/70">Sınır yok</p>
          </div>
        </div>

        {/* Kimlik Doğrulama */}
        <Section
          id="auth"
          title="Kimlik Doğrulama"
          description="Tüm VYS endpoint'leri X-API-Key başlığıyla kimlik doğrulaması gerektirir. Bu anahtar yalnızca /api/vys/* rotalarında geçerlidir; mevcut API_KEY ve ADMIN_KEY'den bağımsızdır."
        >
          <div className="space-y-3">
            <CodeBlock id="auth-header" code={`X-API-Key: <VYS_API_KEY>`} />
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/15">
                <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-[12.5px] text-white/60 space-y-1">
                  <p><span className="text-yellow-400 font-semibold">401</span> — X-API-Key başlığı eksik veya geçersiz</p>
                  <p><span className="text-red-400 font-semibold">503</span> — VYS_API_KEY ortam değişkeni sunucuda ayarlanmamış</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Endpoint 1 */}
        <Section
          id="projects"
          title="Proje Listesi"
          method="GET"
          path="/api/vys/projects"
          description="Aktif (silinmemiş ve arşivlenmemiş) projeleri listeler."
        >
          <CodeBlock id="curl-1" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  ${BASE_URL}/projects`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-1" code={`[
  {
    "id": "abc123",
    "name": "2025 Kurban Organizasyonu",
    "createdAt": "2025-05-01T10:00:00.000Z",
    "totalShareCount": 350
  }
]`} />
          <FieldTable rows={[
            { alan: "id", tur: "string", aciklama: "Proje kimliği" },
            { alan: "name", tur: "string", aciklama: "Proje adı" },
            { alan: "createdAt", tur: "ISO 8601", aciklama: "Oluşturulma zamanı" },
            { alan: "totalShareCount", tur: "number", aciklama: "Projedeki toplam hisse sayısı" },
          ]} />
        </Section>

        {/* Endpoint 2 */}
        <Section
          id="donations"
          title="Bağışçı / Hisse Listesi"
          method="GET"
          path="/api/vys/projects/:id/donations"
          description="Bir projedeki tüm bağışçıları sayfalı olarak döner. Kurban cinsi (donationType), vekalet numarası ve ait olduğu kesim alanı bilgisi dahildir."
        >
          <div className="space-y-1">
            <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Sorgu Parametreleri</p>
            <FieldTable rows={[
              { alan: "page", tur: "number", aciklama: "Sayfa numarası — varsayılan: 1" },
              { alan: "limit", tur: "number", aciklama: "Sayfa başına kayıt — varsayılan: 100, maks: 500" },
            ]} />
          </div>
          <CodeBlock id="curl-2" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  "${BASE_URL}/projects/abc123/donations?page=1&limit=100"`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-2" code={`{
  "items": [
    {
      "id": "9ec662b1-f977-4e9f-ba7a-2c538740e231",
      "name": "FİKRİ BAŞARAN",
      "description": "NEJDET KARABULUT",
      "shareCount": 1,
      "vekalet": "466403",
      "donationType": "Vacip",
      "notes": "",
      "kesimAlaniId": "328268b5-...",
      "kesimAlaniName": "04.05 kesim listesi",
      "tags": [{ "id": "tag-id-1", "name": "VIP" }]
    }
  ],
  "total": 250,
  "page": 1,
  "limit": 100,
  "totalPages": 3
}`} />
          <FieldTable rows={[
            { alan: "items[].id", tur: "string", aciklama: "Bağışçı kimliği" },
            { alan: "items[].name", tur: "string", aciklama: "Adına kesilen kişi" },
            { alan: "items[].description", tur: "string", aciklama: "Vekaleti veren kişi" },
            { alan: "items[].shareCount", tur: "number", aciklama: "Hisse sayısı" },
            { alan: "items[].vekalet", tur: "string", aciklama: "Vekalet numarası" },
            { alan: "items[].donationType", tur: "string", aciklama: "Kurban cinsi (örn. Vacip, Adak, Mevta)" },
            { alan: "items[].notes", tur: "string", aciklama: "Bağışçı notu (boşsa boş string)" },
            { alan: "items[].kesimAlaniId", tur: "string", aciklama: "Ait olduğu kesim alanının kimliği" },
            { alan: "items[].kesimAlaniName", tur: "string", aciklama: "Ait olduğu kesim alanının adı" },
            { alan: "items[].tags", tur: "object[]", aciklama: "Etiketler — { id, name } nesneleri" },
            { alan: "total", tur: "number", aciklama: "Toplam kayıt sayısı" },
            { alan: "totalPages", tur: "number", aciklama: "Toplam sayfa sayısı" },
          ]} />
        </Section>

        {/* Endpoint 3 */}
        <Section
          id="kesim-listesi"
          title="Tüm Kesim Listesi (Bağışçılar Dahil) ✦ Önerilen"
          method="GET"
          path="/api/vys/projects/:id/kesim-listesi"
          description="Tek istekte tüm kesim alanlarını, her alanın hayvan gruplarını ve her grubun bağışçı listesini döner. Kurban cinsi (Vacip / Adak / Mevta), vekalet numarası ve notlar dahildir."
        >
          <CodeBlock id="curl-3" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  ${BASE_URL}/projects/abc123/kesim-listesi`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-3" code={`[
  {
    "id": "ka-001",
    "name": "04.05 kesim listesi",
    "capacity": 200,
    "groups": [
      {
        "id": "group-1",
        "animalNo": 1,
        "colorTag": null,
        "kesildi": false,
        "kesildiAt": null,
        "sortOrder": 1,
        "notes": "",
        "assignedShares": 4,
        "donors": [
          {
            "sira": 1,
            "id": "9ec662b1-...",
            "name": "FİKRİ BAŞARAN",
            "description": "NEJDET KARABULUT",
            "vekalet": "466403",
            "shareCount": 1,
            "donationType": "Vacip",
            "notes": ""
          },
          {
            "sira": 2,
            "id": "d1b3c2a0-...",
            "name": "FİKRET BAŞARAN",
            "description": "NEJDET KARABULUT",
            "vekalet": "466397",
            "shareCount": 1,
            "donationType": "Adak",
            "notes": ""
          }
        ]
      }
    ]
  }
]`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider mt-2">Kesim Alanı Alanları</p>
          <FieldTable rows={[
            { alan: "id", tur: "string", aciklama: "Kesim alanı kimliği" },
            { alan: "name", tur: "string", aciklama: "Kesim alanı adı" },
            { alan: "capacity", tur: "number | null", aciklama: "Maksimum kapasite (ayarlanmadıysa null)" },
            { alan: "groups", tur: "array", aciklama: "Aktif hayvan grupları (boş alan için [])" },
          ]} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider mt-2">Hayvan Grubu Alanları (groups[])</p>
          <FieldTable rows={[
            { alan: "animalNo", tur: "number", aciklama: "Hayvan numarası" },
            { alan: "colorTag", tur: "string | null", aciklama: "Renk etiketi (null = etiketsiz)" },
            { alan: "kesildi", tur: "boolean", aciklama: "Kesim tamamlandı mı?" },
            { alan: "kesildiAt", tur: "ISO 8601 | null", aciklama: "Kesim zamanı" },
            { alan: "notes", tur: "string", aciklama: "Grup notu (boşsa boş string)" },
            { alan: "assignedShares", tur: "number", aciklama: "Gruba atanmış toplam hisse sayısı" },
            { alan: "donors", tur: "array", aciklama: "Gruptaki bağışçılar (sıralı)" },
          ]} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider mt-2">Bağışçı Alanları (donors[])</p>
          <FieldTable rows={[
            { alan: "sira", tur: "number", aciklama: "Grup içindeki sıra (1'den başlar)" },
            { alan: "name", tur: "string", aciklama: "Adına kesilen kişi" },
            { alan: "description", tur: "string", aciklama: "Vekaleti veren kişi" },
            { alan: "vekalet", tur: "string", aciklama: "Vekalet numarası" },
            { alan: "shareCount", tur: "number", aciklama: "Hisse sayısı" },
            { alan: "donationType", tur: "string", aciklama: "Kurban cinsi (Vacip, Adak, Mevta, …)" },
            { alan: "notes", tur: "string", aciklama: "Bağışçı notu (boşsa boş string)" },
          ]} />
        </Section>

        {/* Endpoint 4 */}
        <Section
          id="kesim-alanlari"
          title="Kesim Alanı Listesi"
          method="GET"
          path="/api/vys/projects/:id/kesim-alanlari"
          description="Bir projedeki aktif kesim alanlarını listeler. Sistem dahili __havuz__ alanı bu listede yer almaz."
        >
          <CodeBlock id="curl-4" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  ${BASE_URL}/projects/abc123/kesim-alanlari`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-4" code={`[
  {
    "id": "ka-001",
    "name": "A Alanı",
    "capacity": 7,
    "activeGroupCount": 5
  }
]`} />
          <FieldTable rows={[
            { alan: "id", tur: "string", aciklama: "Kesim alanı kimliği" },
            { alan: "name", tur: "string", aciklama: "Kesim alanı adı" },
            { alan: "capacity", tur: "number | null", aciklama: "Maksimum kapasite (ayarlanmadıysa null)" },
            { alan: "activeGroupCount", tur: "number", aciklama: "Aktif hayvan grubu sayısı" },
          ]} />
        </Section>

        {/* Endpoint 5 — Deprecated */}
        <Section
          id="groups"
          title="Hayvan Grupları ve Kesim Durumu"
          method="GET"
          path="/api/vys/projects/:id/kesim-alanlari/:kesimId/groups"
          description="Belirli bir kesim alanındaki hayvan gruplarını döner. Bağışçı detayları içermez — bunun yerine /kesim-listesi kullanın."
        >
          <CodeBlock id="curl-5b" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  ${BASE_URL}/projects/abc123/kesim-alanlari/ka-001/groups`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-5b" code={`{
  "kesimAlaniId": "ka-001",
  "kesimAlaniName": "A Alanı",
  "items": [
    {
      "id": "group-1",
      "animalNo": 1,
      "colorTag": null,
      "kesildi": true,
      "kesildiAt": "2025-06-15T08:30:00.000Z",
      "sortOrder": 1,
      "assignedShares": 7
    }
  ]
}`} />
          <FieldTable rows={[
            { alan: "items[].animalNo", tur: "number", aciklama: "Hayvan numarası" },
            { alan: "items[].colorTag", tur: "string | null", aciklama: "Renk etiketi" },
            { alan: "items[].kesildi", tur: "boolean", aciklama: "Kesim tamamlandı mı?" },
            { alan: "items[].kesildiAt", tur: "ISO 8601 | null", aciklama: "Kesim zamanı" },
            { alan: "items[].assignedShares", tur: "number", aciklama: "Gruba atanmış hisse sayısı" },
          ]} />
        </Section>

        {/* Endpoint 5 */}
        <Section
          id="summary"
          title="Proje Özeti"
          method="GET"
          path="/api/vys/projects/:id/summary"
          description="Bir proje için özet istatistikler döner: toplam/atanmış/bekleyen hisseler ve kesim durumu."
        >
          <CodeBlock id="curl-5" code={`curl -H "X-API-Key: <VYS_API_KEY>" \\
  ${BASE_URL}/projects/abc123/summary`} />
          <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider">Yanıt · 200 OK</p>
          <CodeBlock id="resp-5" code={`{
  "projectId": "abc123",
  "projectName": "2025 Kurban Organizasyonu",
  "totalShares": 350,
  "assignedShares": 280,
  "unassignedShares": 70,
  "totalGroups": 50,
  "kesildiGroups": 20,
  "remainingGroups": 30
}`} />
          <FieldTable rows={[
            { alan: "totalShares", tur: "number", aciklama: "Toplam hisse sayısı (dışlananlar hariç)" },
            { alan: "assignedShares", tur: "number", aciklama: "Gruba atanmış hisse sayısı" },
            { alan: "unassignedShares", tur: "number", aciklama: "Henüz atanmamış hisse sayısı" },
            { alan: "kesildiGroups", tur: "number", aciklama: "Kesimi tamamlanmış grup sayısı" },
            { alan: "remainingGroups", tur: "number", aciklama: "Bekleyen (kesilmemiş) grup sayısı" },
          ]} />
        </Section>

        {/* Ortam Değişkenleri */}
        <Section
          id="env"
          title="Ortam Değişkenleri"
          description="Sunucuda yapılandırılabilecek VYS ilgili değişkenler."
        >
          <FieldTable rows={[
            { alan: "VYS_API_KEY", tur: "string (zorunlu)", aciklama: "VYS erişim anahtarı — ayarlanmazsa 503 döner" },
            { alan: "GLOBAL_RATE_LIMIT", tur: "number (varsayılan: 200)", aciklama: "Tüm rotalar için genel sunucu limiti" },
          ]} />
        </Section>

        <div className="flex items-center gap-2 p-4 rounded-xl bg-white/2 border border-white/6">
          <Lock className="h-4 w-4 text-white/25 flex-shrink-0" />
          <p className="text-[12.5px] text-white/40">
            Tüm endpoint'ler salt okunurdur (GET). Yazma veya silme işlemi desteklenmez. Büyük listeler için <span className="font-mono text-white/55">page</span> ve <span className="font-mono text-white/55">limit</span> parametrelerini kullanın.
          </p>
        </div>

      </div>
    </div>
  );
}
