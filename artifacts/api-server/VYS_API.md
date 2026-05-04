# VYS API Dokümantasyonu

Bu doküman, VYS'nin KYS API sunucusuna bağlanmak için kullanacağı salt-okunur endpoint'leri açıklamaktadır.

## Kimlik Doğrulama

Tüm VYS endpoint'leri `x-api-key` HTTP başlığı ile kimlik doğrulaması gerektirir.

```
X-API-Key: <VYS_API_KEY değeri>
```

`VYS_API_KEY` sunucudaki ortam değişkeni ile yapılandırılır. Bu anahtar, mevcut `API_KEY` ve `ADMIN_KEY`'den bağımsızdır; yalnızca `/api/vys/*` rotalarında geçerlidir.

**Hata Yanıtları (Kimlik Doğrulama):**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 401 | `X-API-Key` başlığı eksik veya geçersiz |
| 503 | `VYS_API_KEY` ortam değişkeni sunucuda ayarlanmamış |

---

## Temel URL

```
https://<sunucu-adresi>/api/vys
```

---

## Endpoint'ler

### 1. Proje Listesi

Aktif (silinmemiş, arşivlenmemiş) projeleri listeler.

**İstek**
```
GET /api/vys/projects
```

**Başlıklar**
```
X-API-Key: <VYS_API_KEY>
```

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" https://<sunucu>/api/vys/projects
```

**Başarılı Yanıt** `200 OK`
```json
[
  {
    "id": "abc123",
    "name": "2025 Kurban Organizasyonu",
    "createdAt": "2025-05-01T10:00:00.000Z",
    "totalShareCount": 350
  }
]
```

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | string | Proje kimliği |
| `name` | string | Proje adı |
| `createdAt` | ISO 8601 | Oluşturulma zamanı |
| `totalShareCount` | number | Projedeki toplam hisse sayısı |

---

### 2. Bağışçı / Hisse Listesi

Bir projedeki tüm bağışçıları ve hisse bilgilerini döner. Sayfalama desteklenir.

**İstek**
```
GET /api/vys/projects/:id/donations
```

**Sorgu Parametreleri**

| Parametre | Varsayılan | Açıklama |
|-----------|-----------|----------|
| `page` | `1` | Sayfa numarası (1'den başlar) |
| `limit` | `100` | Sayfa başına kayıt (maks. 500) |

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" \
  "https://<sunucu>/api/vys/projects/abc123/donations?page=1&limit=100"
```

**Başarılı Yanıt** `200 OK`
```json
{
  "items": [
    {
      "id": "9ec662b1-f977-4e9f-ba7a-2c538740e231",
      "name": "FİKRİ BAŞARAN",
      "description": "NEJDET KARABULUT",
      "shareCount": 1,
      "vekalet": "466403",
      "donationType": "Vacip",
      "notes": "",
      "kesimAlaniId": "328268b5-b70a-4c19-86b4-21ca1f644678",
      "kesimAlaniName": "04.05 kesim listesi",
      "tags": [
        { "id": "tag-id-1", "name": "VIP" }
      ]
    }
  ],
  "total": 250,
  "page": 1,
  "limit": 100,
  "totalPages": 3
}
```

| Alan | Tür | Açıklama |
|------|-----|----------|
| `items` | array | Bağışçı kayıtları |
| `items[].id` | string | Bağışçı kimliği |
| `items[].name` | string | Adına kesilen kişi |
| `items[].description` | string | Vekaleti veren kişi |
| `items[].shareCount` | number | Hisse sayısı |
| `items[].vekalet` | string | Vekalet numarası |
| `items[].donationType` | string | Kurban cinsi (örn. `"Vacip"`, `"Adak"`) |
| `items[].notes` | string | Bağışçı notu (boşsa `""`) |
| `items[].kesimAlaniId` | string | Bağışçının ait olduğu kesim alanının kimliği |
| `items[].kesimAlaniName` | string | Bağışçının ait olduğu kesim alanının adı |
| `items[].tags` | object[] | Etiket listesi (`{ id, name }` nesneleri) |
| `items[].tags[].id` | string | Etiket kimliği |
| `items[].tags[].name` | string | Etiket görünen adı |
| `total` | number | Toplam kayıt sayısı |
| `page` | number | Mevcut sayfa |
| `limit` | number | Sayfa başına kayıt |
| `totalPages` | number | Toplam sayfa sayısı |

**Hata Yanıtları**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 404 | Proje bulunamadı |

---

### 3. Kesim Alanı Listesi

Bir projedeki aktif kesim alanlarını listeler.

**İstek**
```
GET /api/vys/projects/:id/kesim-alanlari
```

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" \
  https://<sunucu>/api/vys/projects/abc123/kesim-alanlari
```

**Başarılı Yanıt** `200 OK`
```json
[
  {
    "id": "ka-001",
    "name": "A Alanı",
    "capacity": 7,
    "activeGroupCount": 5
  }
]
```

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | string | Kesim alanı kimliği |
| `name` | string | Kesim alanı adı |
| `capacity` | number \| null | Maksimum hayvan kapasitesi (ayarlanmadıysa `null`) |
| `activeGroupCount` | number | Aktif (silinmemiş) hayvan grubu sayısı |

> Not: İç sistem kullanımına ait `__havuz__` adlı kesim alanı bu listede gösterilmez.

**Hata Yanıtları**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 404 | Proje bulunamadı |

---

### 4. Tüm Kesim Listesi (Gruplar Dahil) ✨ Önerilen

Bir projeye ait tüm aktif kesim alanlarını ve her alanın hayvan gruplarını tek HTTP isteğiyle iç içe (nested) döndürür.

Bu endpoint, **Bölüm 3** ve **Bölüm 5**'i birleştirir; N+1 çağrı problemini ortadan kaldırır. VYS'nin kesim listesini görüntülemesi için tercih edilen yöntemdir.

**İstek**
```
GET /api/vys/projects/:id/kesim-listesi
```

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" \
  https://<sunucu>/api/vys/projects/abc123/kesim-listesi
```

**Başarılı Yanıt** `200 OK`
```json
[
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
            "donationType": "Vacip",
            "notes": ""
          }
        ]
      }
    ]
  },
  {
    "id": "ka-002",
    "name": "B Alanı",
    "capacity": null,
    "groups": []
  }
]
```

**Alan Tablosu — Kesim Alanı**

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | string | Kesim alanı kimliği |
| `name` | string | Kesim alanı adı |
| `capacity` | number \| null | Maksimum hayvan kapasitesi (ayarlanmadıysa `null`) |
| `groups` | array | Bu alana ait aktif hayvan grupları (donors dahil) |

**Alan Tablosu — Hayvan Grubu (`groups[]`)**

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | string | Grup kimliği |
| `animalNo` | number | Hayvan numarası |
| `colorTag` | string \| null | Renk etiketi (`null` = etiketsiz) |
| `kesildi` | boolean | Kesildi mi? |
| `kesildiAt` | ISO 8601 \| null | Kesim zamanı (kesilmediyse `null`) |
| `sortOrder` | number | Sıralama değeri |
| `notes` | string | Grup notu (boşsa `""`) |
| `assignedShares` | number | Gruba atanmış toplam hisse sayısı |
| `donors` | array | Bu gruptaki bağışçı listesi (sıralı) |

**Alan Tablosu — Bağışçı (`groups[].donors[]`)**

| Alan | Tür | Açıklama |
|------|-----|----------|
| `sira` | number | Grup içindeki sıra numarası (1'den başlar) |
| `id` | string | Bağışçı kimliği |
| `name` | string | Adına kesilen kişi |
| `description` | string | Vekaleti veren kişi |
| `vekalet` | string | Vekalet numarası |
| `shareCount` | number | Hisse sayısı |
| `donationType` | string | Kurban cinsi (örn. `"Vacip"`, `"Adak"`) |
| `notes` | string | Bağışçı notu (boşsa `""`) |

> Not: `__havuz__` kesim alanı bu yanıtta yer almaz. Henüz grubu olmayan kesim alanları boş `groups: []` dizisiyle döner.

**Hata Yanıtları**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 404 | Proje bulunamadı |

---

### 5. Hayvan Grupları ve Kesim Durumu ⚠️ Deprecated

> **Bu endpoint kullanımdan kaldırılmıştır.** Tek bir kesim alanının gruplarını çekmek yerine **Bölüm 4** (`GET /api/vys/projects/:id/kesim-listesi`) kullanın. Yeni endpoint tüm alanları ve gruplarını tek bir çağrıda döndürerek N+1 HTTP isteği sorununu ortadan kaldırır.

Belirli bir kesim alanındaki hayvan gruplarını ve her grubun kesim durumunu döner.

**İstek**
```
GET /api/vys/projects/:id/kesim-alanlari/:kesimId/groups
```

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" \
  https://<sunucu>/api/vys/projects/abc123/kesim-alanlari/ka-001/groups
```

**Başarılı Yanıt** `200 OK`
```json
{
  "kesimAlaniId": "ka-001",
  "kesimAlaniName": "A Alanı",
  "items": [
    {
      "id": "group-1",
      "animalNo": 1,
      "colorTag": "kırmızı",
      "kesildi": true,
      "kesildiAt": "2025-06-15T08:30:00.000Z",
      "sortOrder": 1,
      "assignedShares": 7
    },
    {
      "id": "group-2",
      "animalNo": 2,
      "colorTag": "mavi",
      "kesildi": false,
      "kesildiAt": null,
      "sortOrder": 2,
      "assignedShares": 5
    }
  ]
}
```

| Alan | Tür | Açıklama |
|------|-----|----------|
| `kesimAlaniId` | string | Kesim alanı kimliği |
| `kesimAlaniName` | string | Kesim alanı adı |
| `items` | array | Hayvan grubu kayıtları |
| `items[].id` | string | Grup kimliği |
| `items[].animalNo` | number | Hayvan numarası |
| `items[].colorTag` | string | Renk etiketi |
| `items[].kesildi` | boolean | Kesildi mi? |
| `items[].kesildiAt` | ISO 8601 \| null | Kesim zamanı (kesilmediyse `null`) |
| `items[].sortOrder` | number | Sıralama değeri |
| `items[].assignedShares` | number | Gruba atanmış toplam hisse sayısı |

**Hata Yanıtları**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 404 | Proje veya kesim alanı bulunamadı |

---

### 6. Proje Özeti

Bir proje için özet istatistikleri döner.

**İstek**
```
GET /api/vys/projects/:id/summary
```

**Örnek cURL**
```bash
curl -H "X-API-Key: my-vys-key" \
  https://<sunucu>/api/vys/projects/abc123/summary
```

**Başarılı Yanıt** `200 OK`
```json
{
  "projectId": "abc123",
  "projectName": "2025 Kurban Organizasyonu",
  "totalShares": 350,
  "assignedShares": 280,
  "unassignedShares": 70,
  "totalGroups": 50,
  "kesildiGroups": 20,
  "remainingGroups": 30
}
```

| Alan | Tür | Açıklama |
|------|-----|----------|
| `projectId` | string | Proje kimliği |
| `projectName` | string | Proje adı |
| `totalShares` | number | Toplam hisse sayısı (dışlananlar hariç) |
| `assignedShares` | number | Hayvan grubuna atanmış hisse sayısı |
| `unassignedShares` | number | Henüz atanmamış hisse sayısı |
| `totalGroups` | number | Toplam hayvan grubu sayısı |
| `kesildiGroups` | number | Kesimi tamamlanmış grup sayısı |
| `remainingGroups` | number | Bekleyen (kesilmemiş) grup sayısı |

**Hata Yanıtları**

| HTTP Kodu | Açıklama |
|-----------|----------|
| 404 | Proje bulunamadı |

---

## Genel Hata Formatı

Tüm hata yanıtları aşağıdaki formattadır:

```json
{
  "error": "Hata açıklaması."
}
```

## Önemli Notlar

- Tüm VYS endpoint'leri **salt okunurdur** (yalnızca GET). Yazma veya silme işlemi desteklenmez.
- Yanıtlar yalnızca VYS'nin ihtiyaç duyduğu alanları içerir; iç sistem alanları (telefon, notlar, AI kategorileri vb.) gizlidir.
- Büyük bağışçı listeleri için `page` ve `limit` parametrelerini kullanarak sayfalama yapın.
- `VYS_API_KEY`, diğer API anahtarlarıyla (`API_KEY`, `ADMIN_KEY`) karıştırılmamalı; yalnızca VYS entegrasyonu için kullanılmalıdır.
- Kesim listesini tek seferde çekmek için **Bölüm 4** (`/kesim-listesi`) tercih edilmeli; **Bölüm 5** (`/kesim-alanlari/:kesimId/groups`) artık kullanımdan kaldırılmıştır.
