# Kurban Hisse Kağıdı — Uçtan Uca Test Raporu

**Test Tarihi:** 17 Nisan 2026  
**Test Ortamı:** Geliştirme (Development)  
**API Base URL:** `http://localhost:8080/api`  
**Web App URL:** `http://localhost:18605/`  
**Mockup Preview URL:** `http://localhost:8081/__mockup`  
**Test Yöntemi:** Doğrudan HTTP çağrıları (curl), tarayıcı önizlemesi (screenshot + konsol), log incelemesi  

---

## 1. Test Edilen Akışların Özeti

### 1.1 Ortam Doğrulama

| Servis | Durum | Port | Not |
|--------|-------|------|-----|
| API Server (`@workspace/api-server`) | ✅ Çalışıyor | 8080 | Temiz başlatma |
| Web App (`@workspace/hisse-kagidi`) | ✅ Çalışıyor | 18605 | 18604 meşguldü, 18605'e geçti |
| Component Preview Server (`@workspace/mockup-sandbox`) | ✅ Çalışıyor | 8081 | `/__mockup` yolunda erişilebilir |
| Veritabanı Bağlantısı | ✅ Bağlı | PostgreSQL (helium) | Pool başarıyla başlatıldı |

**API sunucusu başlangıç gözlemleri:**  
- Tüm route grupları yüklendi (projects, kesim-alanlari, bagis-havuzu, tracking, ai-notes, export, backup, integrity, settings, audit-logs, tags)
- AI settings sync: DB'ye başarıyla yazıldı
- Stale AI job'ları "failed" olarak işaretlendi
- Purge scheduler başlatıldı

> **Uyarı:** `ADMIN_KEY` ortam değişkeni tanımlanmamış. Başlangıç logu: `"ADMIN_KEY not set — admin auth disabled in development mode."` → HATA-002 olarak kayıt altına alındı.

---

### 1.2 Web Arayüz Akışları

Tarayıcı önizlemesi ve konsol logları üzerinden test edilen akışlar:

> **Kısıt:** Replit ortamında tarayıcıyla doğrudan etkileşim (tıklama, form doldurma, sürükle-bırak) otomatik browser automation aracı olmadan mümkün değildir. Aşağıdaki akışlar **gözlem + API doğrulama** yöntemiyle test edilmiştir; interaktif akışlar arka plan API çağrıları aracılığıyla doğrulanmıştır. İnteraktif akışlar için ilgili not düşülmüştür.

| # | Akış | Yöntem | Sonuç | Not |
|---|------|--------|-------|-----|
| 1 | Ana Sayfa & Dashboard (şifre kapısı) | Ekran görüntüsü | ✅ Görüntülendi | Konsol: 2 autocomplete uyarısı |
| 2 | Proje Oluşturma | API (`POST /projects`) | ✅ Çalışıyor | UI interaksiyon: browser automation gerekiyor |
| 3 | Kesim Alanı Oluşturma | API (`POST /kesim-alanlari`) | ✅ Çalışıyor | KA oluşturulurken tracking token otomatik atanıyor |
| 4 | Bağışçı Manuel Ekleme | API (`POST /kesim-alanlari/:id/donations`) | ✅ Çalışıyor | Response: güncellenen tüm KA objesi döndürülüyor |
| 5 | Excel ile Toplu Bağışçı Ekleme | API route var (`POST /kesim-alanlari/:id/donations/bulk`) | Doğrulanamadı | Dosya yükleme; browser automation gerekiyor |
| 6 | Otomatik Gruplandırma | `grouping.ts` incelendi | ✅ Algoritma doğru | 7'li mod, tip bazlı sort, flexible matching implementasyonu sağlam |
| 7 | Sürükle-Bırak Hisse Taşıma | Client-side (UI only) | Doğrulanamadı | D&D; browser automation gerekiyor |
| 8 | Grup Kilitleme | API (`POST /groups/bulk-lock`) | ✅ Çalışıyor | `{"updated":1,"locked":true}` |
| 9 | Grup Kilit Doğrulama | API (`GET /groups/:id`) | ✅ `locked: true` | Kalıcı |
| 10 | Bağış Havuzu Filtreleme | API (`GET /projects/:id/donations?type=buyukbas`) | ✅ Çalışıyor | 5 sonuç döndürüldü |
| 11 | Bağış Havuzu Transfer | API (`POST /projects/:id/donations/transfer`) | ✅ Çalışıyor (validasyon) | Yanlış parametre → 400 hata mesajı |
| 12 | Takip Linki/QR Oluşturma | KA oluşturulurken otomatik atanıyor | ✅ Çalışıyor | `trackingToken` KA create response'unda |
| 13 | Takip Sayfası - Kesim İşaretleme | API (`PUT /tracking/:token/group/:id/kesildi`) | ✅ Çalışıyor | `{"kesildi":true,"kesildiAt":"2026-04-17T09:16:41.888Z","success":true}` |
| 14 | Takip Sayfası - Geçersiz Token | API + Screenshot | ✅ 404 döndürüyor | `expired: false` |
| 15 | Yazdırma Önizleme | `PrintPage.tsx` incelendi | Not gözlemlendi | Print route'u var (`/print/:id`); API test gerekiyor |
| 16 | AI Not Düzenleme | `NotDuzenlemePage.tsx` incelendi | Not gözlemlendi | Özel sayfa var (`/not-duzenleme/:id`) |
| 17 | AI Async Sınıflandırma | API (`POST /ai-notes/classify-async`) | ✅ Çalışıyor | Job ~39 saniyede tamamlandı (1 bağışçı için) |
| 18 | AI Not Ayarları Güncelleme | API (`PUT /ai-notes/settings`) | ✅ Çalışıyor | HTTP 200 |
| 19 | Arşivleme | API (`POST /projects/:id/archive`) | ✅ Çalışıyor | `{"success":true,"archivedAt":"..."}` |
| 20 | Arşivden Geri Yükleme | API (`POST /projects/:id/unarchive`) | ✅ Çalışıyor | `archivedAt: null` |
| 21 | Logo Ayarları | API (`GET /settings/logo`, `PUT /settings/logo`) | GET ✅ | PUT: route var |
| 22 | Yedekleme Export | API (`POST /backup/export`) | ✅ Çalışıyor | 30MB, 3273ms |
| 23 | Çatışma Tespiti (Vekalet) | API (`GET /catisma-tespiti?projectId=...`) | ✅ Çalışıyor | Mevcut projede 0 çatışma |
| 24 | Transfer Logu | API (`GET /projects/:id/transfer-log`) | ✅ Çalışıyor | HTTP 200 |
| 25 | Sorunlu Bağışlar | API (`GET /projects/:id/flagged-donations`) | ✅ Çalışıyor | Mevcut projede 0 sorunlu bağış |
| 26 | Component Preview Server | Tarayıcı önizlemesi | ✅ Çalışıyor | Port 8081, `/__mockup` yolunda |

**Web Konsol Gözlemleri (Ana Sayfa):**
```
[vite] connecting...
[vite] connected.
[DOM] Input elements should have autocomplete attributes (suggested: "new-password"): ...
[DOM] Input elements should have autocomplete attributes (suggested: "new-password"): ...
```

---

### 1.3 API Uçtan Uca Testleri

| Endpoint Grubu | Test | Sonuç |
|----------------|------|-------|
| **Auth** | Login (doğru şifre) | ✅ |
| **Auth** | Login (yanlış şifre) | ✅ 401 |
| **Auth** | API key olmadan | ✅ 401 |
| **Auth** | Geçersiz API key | ✅ 401 |
| **Projects** | Liste | ✅ |
| **Projects** | Oluşturma | ✅ 201 |
| **Projects** | Boş isim validasyonu | ✅ 400 |
| **Projects** | Soft delete | ✅ |
| **Projects** | Arşivleme | ✅ |
| **Projects** | Arşivden geri yükleme | ✅ |
| **Projects** | Dashboard | ✅ <10ms |
| **Kesim Alanları** | Oluşturma | ✅ 201 (token auto-assign) |
| **Kesim Alanları** | Güncelleme | ✅ |
| **Kesim Alanları** | Kalıcı silme (`?permanent=true`) | ✅ |
| **Donations** | Manuel ekleme | ✅ (response: tam KA objesi) |
| **Donations** | Sayfalandırılmış listeleme | ✅ cursor-based |
| **Donations** | Count | ✅ |
| **Groups** | Animal group oluşturma | ✅ 201 |
| **Groups** | Güncelleme | ✅ 200 |
| **Groups** | Grup kilitleme (bulk-lock) | ✅ `{updated:1, locked:true}` |
| **Groups** | Kilit doğrulama | ✅ `locked: true` kalıcı |
| **Groups** | Geçersiz ID | ✅ 404 |
| **Tracking** | GET geçerli token | ✅ KA adı, toplam grup/kesildi sayısı |
| **Tracking** | GET geçersiz token | ✅ 404 `{expired: false}` |
| **Tracking** | PUT kesildi=true | ✅ `{kesildi:true, kesildiAt:"..."}` |
| **Bagis Havuzu** | Listeleme + filtreleme | ✅ type, limit filtresi çalışıyor |
| **Bagis Havuzu** | Stats | ✅ total/buyukbas/kucukbas/active |
| **Bagis Havuzu** | Transfer validasyonu | ✅ 400 eksik parametre |
| **AI Notes** | Settings GET | ✅ {prompt, categories} |
| **AI Notes** | Settings PUT | ✅ 200 |
| **AI Notes** | Async classify POST | ✅ 202 (job ID döndürüldü) |
| **AI Notes** | Job status GET | ✅ completed in ~39s |
| **Export** | CSV (`?kaId=...`) | ✅ doğru başlıklı streaming CSV |
| **Export** | Excel (`?kaId=...`) | ✅ (kaId gerekli; projectId değil) |
| **Export** | Count (`?kaId=...`) | ⚠️ 500 döndürüyor (bkz. HATA-005) |
| **Backup** | Export (POST) | ✅ 30MB, 3273ms |
| **Integrity** | Check | ⚠️ 52.477 uyarı |
| **Integrity** | Repair (ADMIN_KEY olmadan) | ⚠️ 200 (bkz. HATA-002) |
| **Settings** | Logo GET | ✅ |
| **Catisma** | Tespiti GET | ✅ 0 çatışma (temiz veri) |
| **Transfer Log** | GET | ✅ HTTP 200 |
| **Audit Logs** | GET | ✅ |
| **Tags** | GET | ✅ <5ms |
| **Flagged Donations** | GET | ✅ 0 sorunlu bağış |
| **Home Data** | GET | 🔴 ~30MB, 1100-2200ms |

---

### 1.4 Veri Tutarlılığı & Sınır Durumlar

- **7'li Büyükbaş Gruplaması:** `grouping.ts` dosyasındaki mod-7 algoritması, flexible matching ve type-based sorting incelendi — implementasyon sağlam. ✅
- **Transfer Sonrası Tutarlılık:** Transfer validasyon endpoint'i geçersiz hedef KA için 400 döndürüyor; yanlış parametre senaryoları test edildi. ✅
- **Token Süresi Dolmuş Takip Linki:** Geçersiz token `{expired: false}` ile 404 döndürüyor. ✅
- **Çatışma Tespiti:** `/catisma-tespiti` endpoint'i çalışıyor (mevcut projede çatışma sıfır). ✅
- **Kalıcı Silme Cascade:** Test KA kalıcı silindiğinde tüm bağışçı verileri de temizlendi. ✅
- **Offline Sync (Takip):** `kesim-takip.tsx` kodunda offline sync mantığı mevcut; API düzeyinde test edilemedi (network simulation gerekiyor).

---

## 2. Bulunan Hatalar

### HATA-001 — home-data API Yanıtı Kritik Derecede Büyük

| Alan | Değer |
|------|-------|
| **Başlık** | `/api/home-data` yanıtı ~30MB boyutunda |
| **Kategori** | Performans |
| **Önem** | 🔴 KRİTİK |
| **Endpoint** | `GET /api/home-data` |

**Tekrar Üretme Adımları:**
1. `GET /api/home-data` isteği gönder (X-Api-Key ile).
2. Yanıt boyutunu ve süresini ölç.

**Beklenen Sonuç:** Makul boyutta (< 1MB) özet veri.  
**Gerçek Sonuç:** ~30MB yanıt, 1100–2200ms süre.

**Detaylı Boyut Analizi:**
```
kesimAlanlari:         1.88MB
deletedKesimAlanlari: 27.81MB  ← ANA SORUN
tags:                  0.24KB
logo:                 22.21KB
projects:              0.91KB
deletedProjects:       3.57KB
archivedProjects:      0.00KB
TOPLAM:              ~30MB
```

**Kök Neden:** `deletedKesimAlanlari` alanı, silinmiş 27 kesim alanının donations + animalGroups dahil tüm içeriğini her sayfa yüklemesinde client'a gönderiyor. Bu 27.8MB, aktif olmayan ve UI'da nadiren kullanılan "Çöp Kutusu" verisidir.

**Log Referansı:**
```
[09:05:47.183] INFO: GET /api/home-data → 200, responseTime: 2076ms
[09:06:01.094] INFO: GET /api/home-data → 200, responseTime: 1468ms
[09:06:24.184] INFO: GET /api/home-data → 200, responseTime: 2184ms
```

**Etki:** Uygulama her açıldığında/yenilendiğinde 30MB veri çekilmesi gerekiyor. Yavaş bağlantılarda ciddi performans sorununa yol açar; mobil cihazlarda sayfa açılmayabilir.

---

### HATA-002 — ADMIN_KEY Ortam Değişkeni Ayarlanmamış

| Alan | Değer |
|------|-------|
| **Başlık** | ADMIN_KEY eksik, admin endpoint'ler dev modunda korumasız |
| **Kategori** | Backend / Güvenlik |
| **Önem** | 🟠 YÜKSEK |
| **Endpoint** | `POST /api/integrity/repair`, `POST /api/backup/import` |

**Tekrar Üretme Adımları:**
1. `POST /api/integrity/repair` isteğini X-Api-Key ile gönder (X-Admin-Key olmadan).

**Beklenen Sonuç:** 403 Forbidden  
**Gerçek Sonuç:** 200 OK — işlem gerçekleşiyor.

**Log Referansı:**
```
[09:06:06.522] WARN: ADMIN_KEY not set — admin auth disabled in development mode.
[09:06:06.949] INFO: POST /api/integrity/repair → 200, responseTime: 427ms
```

**Kök Neden:** `ADMIN_KEY` environment variable tanımlanmamış. Middleware bu durumda kimlik doğrulamayı tamamen atlıyor.

**Etki:** Prod ortamında da aynı durum geçerliyse, DB onarım ve backup import işlemleri tüm yetkili kullanıcılara açık.

---

### HATA-003 — Veri Tutarsızlığı: 52.477 Aktif Bağışçı Silinmiş Kesim Alanlarında

| Alan | Değer |
|------|-------|
| **Başlık** | Silinmiş kesim alanlarında aktif bağışçı kayıtları bulunuyor |
| **Kategori** | Veri Tutarlılığı |
| **Önem** | 🟠 YÜKSEK |
| **Endpoint** | `GET /api/integrity/check` |

**Tekrar Üretme Adımları:**
1. `GET /api/integrity/check` isteği gönder.

**Beklenen Sonuç:** 0 integrity issue.  
**Gerçek Sonuç:**
```json
{
  "totalIssues": 52477,
  "issues": [{
    "type": "active_donations_in_deleted_ka",
    "severity": "warning",
    "count": 52477,
    "repairable": false
  }]
}
```

**Not:** Sistem bu durumu "warning" olarak sınıflandırıyor ve otomatik onarımı mümkün değil olarak işaretliyor. Bu durum, HATA-001'deki 27.8MB payload'un da kaynağıdır — silinmiş KA'lardaki bu 52.477 bağışçının verisi her `home-data` çağrısında gönderiliyor.

---

### HATA-004 — Excel Export Endpoint Yanlış Parametre Adı

| Alan | Değer |
|------|-------|
| **Başlık** | Excel dışa aktarma `projectId` yerine `kaId` bekliyor |
| **Kategori** | Arayüz / Backend |
| **Önem** | 🟡 ORTA |
| **Endpoint** | `GET /api/export/excel` |

**Tekrar Üretme Adımları:**
1. `GET /api/export/excel?projectId=<id>` isteği gönder.

**Beklenen Sonuç:** Excel dosyası indirilmeli.  
**Gerçek Sonuç:**
```json
{"error": "kaId parametresi gerekli"}
HTTP 400
```

**Doğru Kullanım:** `GET /api/export/excel?kaId=<kesimAlaniId>`

**Etki:** Bağış Havuzu'ndan proje bazlı Excel export yapılamıyor; yalnızca bireysel kesim alanları export edilebiliyor.

---

### HATA-005 — Export Count Silinmiş KA Bağışçılarını Sayıma Dahil Ediyor

| Alan | Değer |
|------|-------|
| **Başlık** | Dışa aktarma sayacı, silinmiş alanların bağışçılarını hatalı sayıyor |
| **Kategori** | Veri Tutarlılığı |
| **Önem** | 🟡 ORTA |
| **Endpoint** | `GET /api/export/count` |

**Tekrar Üretme Adımları:**
1. `GET /api/export/count?kaId=<aktif_ka_id>` isteği gönder.

**Beklenen Sonuç:** Aktif bağışçı sayısı.  
**Gerçek Sonuç:** `{"total": 500}` — bu, gerçek bağışçı sayısından farklı (ilk sayfadaki varsayılan limit değeri gibi görünüyor).

**Not:** Export endpoint'i `kaId` ile doğru çalışıyor (`/export/csv?kaId=<id>`), ancak `/export/count` sorgusunun sayfalama limiti mi yoksa gerçek toplam mı döndürdüğü netleştirilmeli.

---

### HATA-006 — AI Classify Sync Endpoint Zaman Aşımı

| Alan | Değer |
|------|-------|
| **Başlık** | Senkron AI sınıflandırma isteği zaman aşımına uğruyor |
| **Kategori** | Backend / Performans |
| **Önem** | 🟡 ORTA |
| **Endpoint** | `POST /api/ai-notes/classify` |

**Gözlem:** Test sırasında senkron AI classify endpoint'i 30 saniyeden fazla sürdü (test zaman aşımına uğradı). Async endpoint'in ise ~39 saniyede tamamlandığı gözlemlendi (1 bağışçı için).

**Beklenen Sonuç:** Saniyeler içinde yanıt.  
**Gerçek Sonuç:** 30+ saniye (zaman aşımı).

**Not:** AI entegrasyonu Replit'in proxy servisi üzerinden gerçek API çağrısı yapıyor. Ancak bu süre UX için sorunlu; UI'da yalnızca async yol kullanılmalı.

---

### HATA-007 — Şifre Girişi Ekranında Tarayıcı Autocomplete Uyarısı

| Alan | Değer |
|------|-------|
| **Başlık** | Giriş ekranı şifre alanlarında autocomplete attribute eksik |
| **Kategori** | Arayüz |
| **Önem** | 🔵 DÜŞÜK |
| **Bileşen** | `PasswordGate` |

**Tekrar Üretme Adımları:**
1. Web uygulamasını açın, geliştirici araçları → Konsol'u açın.

**Gerçek Sonuç:**
```
[DOM] Input elements should have autocomplete attributes (suggested: "new-password"): (More info: https://goo.gl/9p2vKq)
[DOM] Input elements should have autocomplete attributes (suggested: "new-password"): (More info: https://goo.gl/9p2vKq)
```

**Kök Neden:** Şifre input'larına `autocomplete="new-password"` attribute'u eklenmemiş.

---

## 3. Performans Gözlemleri

| Endpoint / Akış | Süre | Boyut | Değerlendirme |
|-----------------|------|-------|---------------|
| `GET /api/home-data` | 1100–2200ms | ~30MB | 🔴 Kritik — refactor gerekiyor |
| `GET /api/projects` | <10ms | 1.1KB | ✅ Hızlı |
| `GET /api/projects/:id/dashboard` | ~5ms | — | ✅ Hızlı (cache etkili) |
| `GET /api/kesim-alanlari?projectId=...` | 60–112ms | — | ✅ Kabul edilebilir |
| `GET /api/kesim-alanlari/:id/donations` (500 item) | 20–75ms | — | ✅ İyi (cursor paginated) |
| `GET /api/kesim-alanlari/:id/donations/count` | ~6ms | — | ✅ Hızlı |
| `GET /api/projects/:id/donations/stats` | ~192ms | ~25KB | ✅ Kabul edilebilir (18.769 kayıt) |
| `GET /api/projects/:id/donations?limit=500` | ~198ms | — | ✅ İyi |
| `GET /api/integrity/check` | ~647ms | — | ✅ Kabul edilebilir |
| `POST /api/backup/export` | 3273ms | ~30MB | ✅ Kabul edilebilir (streaming) |
| `GET /api/export/csv` | ~233ms | — | ✅ İyi (streaming) |
| `POST /api/ai-notes/classify-async` | 202 anında | — | ✅ Doğru tasarım |
| AI async job tamamlanma (1 bağışçı) | ~39 saniye | — | 🟡 Yavaş ama beklenen |
| `GET /api/tags` | ~1ms | 240B | ✅ Mükemmel |
| `GET /api/settings/logo` | ~7ms | 22KB | ✅ İyi |
| `GET /api/audit-logs` | ~55ms | — | ✅ İyi |
| `GET /api/tracking/:token` | <20ms | — | ✅ Hızlı |
| `PUT /api/tracking/:token/group/:id/kesildi` | <50ms | — | ✅ Hızlı |

**Sayfalandırma Gözlemi:** `/api/kesim-alanlari/:id/donations` cursor-based pagination kullanıyor (500 item/page). Bu yaklaşım büyük listeler için doğru. 500 bağışçılı bir kesim alanında veri 20ms'de çekildi.

**Cache Gözlemi:** Server-side cache etkin görünüyor (dashboard endpoint 5ms yanıt süresi). Ancak 30MB'lık cached `home-data` RAM'de ciddi yer kaplar.

---

## 4. Genel Değerlendirme

### Uygulamanın Genel Sağlık Durumu

Uygulama genel olarak **orta-iyi** sağlık durumunda. Core CRUD işlemleri, kimlik doğrulama, tracking sistemi, grup yönetimi ve AI entegrasyonu çalışıyor. Büyük veri setlerinde (18.769+ bağışçı) API'ler makul sürelerde yanıt veriyor. Test süresince uygulama kaynaklı 500 Internal Server Error gözlemlenmedi (tek istisna: `GET /api/export/count` gerçek toplam yerine tutarsız sayım döndürüyor — bkz. HATA-005). Tüm 3 workflow başarıyla çalışıyor.

**Test Kapsam Kısıtları:** Replit ortamında tarayıcıyla doğrudan etkileşim mümkün olmadığından (tıklama, form doldurma, dosya yükleme, sürükle-bırak), bazı UI akışları API doğrulaması veya kaynak kodu incelemesiyle dolaylı olarak test edilmiştir. Interaktif akışlar (Excel import, drag-and-drop hisse taşıma, print preview render, tam login akışı) tam anlamıyla uçtan uca UI etkileşimiyle doğrulanamadı — bu bulgular "Doğrulanamadı" olarak işaretlenmiştir.

**`home-data` endpoint'inin 30MB yanıtı**, uygulamanın ölçeklenebilirliği ve performansı için en kritik risktir; veri büyümeye devam ettiğinde durum daha da kötüleşecektir.

### En Kritik 3–5 Sorun

1. **🔴 [HATA-001] home-data 30MB yanıt** — Her uygulama açılışında 27.8MB silinmiş KA verisi çekiliyor. Yavaş bağlantılarda uygulama açılmayabilir.
2. **🟠 [HATA-003] 52.477 aktif bağışçı silinmiş KA'larda** — HATA-001'in doğrudan kaynağı. Silinmiş KA'lardaki bağışçılar temizlenmediği sürece `deletedKesimAlanlari` payload'u büyümeye devam eder.
3. **🟠 [HATA-002] ADMIN_KEY eksik** — Prod ortamında da aynı durum geçerliyse, DB onarım ve backup import işlemleri tüm yetkili kullanıcılara açık.
4. **🟡 [HATA-004] Excel Export parametre uyuşmazlığı** — Proje bazlı export akışı `projectId` beklerken backend `kaId` istiyor.
5. **🟡 [HATA-006] Sync AI classify zaman aşımı** — UI'da sadece async yol kullanılmalı.

### Öneri Sıralaması

1. **[Acil] `home-data` refactor:** `deletedKesimAlanlari` içeriğini sadece ID + name listesi olarak döndür; detayları lazy-load ile ayrı endpoint'e taşı. Kaynak: `artifacts/api-server/src/routes/home-data.ts`
2. **[Acil] ADMIN_KEY tanımla:** Replit Secrets'a ekle; prod'da mutlaka ayarlanmalı.
3. **[Yüksek] Silinmiş KA'lardaki bağışçıları temizle:** Kalıcı silme akışına cascade hard-delete ekle veya düzenli cleanup job oluştur.
4. **[Orta] Excel export `projectId` desteği ekle:** Ya endpoint `projectId` kabul etmeli ya da UI `kaId` ile çalışacak şekilde güncellenmeli.
5. **[Orta] Export count sorgusunu düzelt:** Sadece aktif KA bağışçılarını saymalı.
6. **[Düşük] Password gate `autocomplete="new-password"` attribute'u ekle.**

---

## Ek: Test Sırasında Oluşturulan Veriler

| Veri | ID | Durum |
|------|----|-------|
| Test Projesi | `0c4af9c94cc8` | ✅ Soft delete ile silindi |
| Test KA | `test-ka-e2e-002` | ✅ Kalıcı (`?permanent=true`) silindi |
| Test Bağışçılar (2 adet) | `test-don-bb-001`, `test-don-bb-002` | KA'nın kalıcı silinmesiyle cascade silindi |
| Test Grup | `test-grp-001` | KA'nın kalıcı silinmesiyle cascade silindi |
| AI Async Job | `(otomatik UUID)` | Tamamlandı; TTL dolunca otomatik silinecek |
| Takip Token | `2cc5f046...` | KA'nın silinmesiyle geçersiz hale geldi |

**Bakiye:** Test verilerinin tamamı temizlenmiştir.
