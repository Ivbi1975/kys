# Kurban Hisse Kağıdı Yönetim Sistemi — Sistem Raporu

---

## Çalışma Prensibi

Sistem üç katmandan oluşuyor:

### 1. Frontend (React + Vite)
Tarayıcıda çalışan arayüz. Wouter ile sayfa yönlendirmesi, TanStack Query ile sunucu verisi önbellekleme yapıyor. Tailwind + shadcn/ui ile modern, responsive tasarım. Tüm veriler API sunucusu üzerinden okunup yazılıyor — tarayıcıda kalıcı veri yok.

### 2. Backend (Express 5 — Port 8080)
REST API sunucusu. Her istek önce API anahtarı doğrulamasından geçiyor. Pino ile yapılandırılmış log tutuluyor. Uzun süren AI işleri asenkron job olarak arka planda işleniyor; frontend polling yaparak takip ediyor.

### 3. Veritabanı (PostgreSQL + Drizzle ORM)
Uzak sunucuda (45.84.191.103) çalışıyor. 18 tablo var. Silme işlemleri "soft delete" — yani kayıtlar `deleted_at` alanıyla işaretleniyor, 90 gün sonra otomatik temizleniyor. AI sonuçları da bu tablolara yazılıyor.

### Genel İş Akışı

```
Kullanıcı → Şifre Doğrulama → Proje/Kesim Alanı Oluştur
→ Bağış Havuzu'na veri import et
→ AI ile notları sınıflandır
→ Kesim alanlarına bağış aktar
→ Hisse kağıtlarını yazdır
→ Saha ekibi takip linki ile canlı takip yapar
```

---

## Sayfa ve Fonksiyon Tanıtımı

---

### 1. Giriş (Şifre Kapısı)

Her şeyden önce şifre ekranı geliyor. Doğru şifre girildiğinde `sessionStorage`'a token yazılıyor; sekme kapatılınca oturum sona eriyor. `/takip/:token` sayfası bu kapının dışında — saha ekibi için şifresiz erişilebilir.

---

### 2. Ana Sayfa `/`

Sistemin merkezi. İki ana blok var:

**Projeler**
- Yeni proje oluşturma, yeniden adlandırma, arşivleme, silme
- Her projenin altında kesim alanları ağaç yapısında gösteriliyor

**Kesim Alanları (Projesiz)**
- Projeye bağlı olmayan bağımsız kesim alanları listeleniyor

**Üst araç çubuğu:**
- **Global Arama** — Tüm projeler ve kesim alanlarını aynı anda isimle arar
- **QR Kod** — Saha takip linki için QR üretir
- **Tema** — Açık / koyu / sistem teması
- **Çıkış** — Oturumu sonlandırır

**Ayarlar Diyaloğu** (dişli ikonu):
- Logo yükleme/silme (print sayfalarında görünür)
- Yedek al (JSON) / Yedek geri yükle
- CSV dışa aktarma (tüm sistem verisi)
- Global etiket yönetimi (renk + ad)
- Bütünlük kontrolü ve otomatik onarım
- AI Prompt Ayarları'na kısayol
- Tema seçimi

**Arşiv bölümü:** Arşivlenmiş projeler ayrı bölümde listelenir, geri açılabilir.

**Denetim Logu (Audit Log):** Kim, ne zaman, ne değiştirdi — tüm işlemler kayıt altında.

---

### 3. Proje Detay `/proje/:id`

Bir projenin içinde ne olduğunu gösteren özet ekranı.

- **Proje Özeti Kartı:** Toplam hayvan, bağışçı, doluluk oranı
- **Bağış Havuzu Özeti:** Henüz atanmamış havuzdaki bağış sayısı, AI sınıflandırma durumu
- **Bekleyen Düzenleme İstekleri:** Saha ekibinden gelen not/değişiklik talepleri
- **Kesim Alanları Listesi:** Projeye bağlı tüm alanlar, doluluk çubukları ile
- **Çakışma Tespiti:** Aynı bağışçının birden fazla hayvanla eşleştirildiği durumlar
- **Transfer Logu:** Havuzdan kesim alanına hangi bağışların ne zaman taşındığı
- **Bölme (Split) Modal:** Bir kesim alanını ikiye böler

---

### 4. Kesim Alanı `/kesim/:id`

Bağışçıların hayvanlara atandığı ana çalışma ekranı.

**Hayvan Grupları:**
- Her grup N hisseden oluşur (1, 7 vb.)
- Her hisseye bağışçı adı, türü (vacip/adak/nafile...), not, özellik etiketleri atanır
- "Kesildi" olarak işaretlenebilir

**İşlevler:**
- Bağışçı ekleme / düzenleme / silme
- Toplu bağışçı kopyala-yapıştır
- **Sepet sistemi:** Başka kesim alanlarından kopyalanacak bağışçılar sepete atılır, buraya aktarılır
- Not takibi (bağışçı bazlı)
- Takip notu oluşturma (saha için mesaj)
- Kesim alanını sil / arşivle / yeniden adlandır

---

### 5. Yazdırma / Print Önizleme `/print/:id`

Hisse kağıtlarının hazırlandığı sayfa. Tarayıcının yazdır diyaloğu ile PDF veya fiziksel baskı alınır.

**5 farklı şablon:**

| Şablon | Açıklama |
|---|---|
| Standart | Klasik tablo düzeni, geniş bilgi |
| Dikey (Portrait) | Dikey kağıt uyumlu |
| Kompakt | Daha küçük font, daha fazla satır |
| İsim Listesi | Sadece isimlerden oluşan liste |
| Özet | Hayvan bazlı özet görünüm |

**Ayar seçenekleri:**
- Hangi kolonların görüneceği (isim, tür, not, sıra no, QR...)
- Font boyutları (başlık, içerik, etiketler için ayrı ayrı)
- Renk ayarları (her bağış türüne farklı renk)
- Logo göster/gizle
- QR kod dahil et
- Belirli bağış türlerini filtrele (sadece "vacip" olanları yazdır gibi)

**Dışa aktarma:**
- Excel export (filtrelenmiş veya tüm liste)

---

### 6. Not Düzenleme `/not-duzenleme/:id`

Bir kesim alanının tüm bağışçı notlarını toplu düzenlemek için özel tam ekran editör.

**Özellikler:**
- Her bağışçının notu satır satır listelenir, tıklanarak düzenlenir
- **Bul & Değiştir:** Belirli bir kelimeyi tüm notlarda otomatik değiştirir
- **Geri Al / İleri Al (Undo/Redo):** Son 50 değişikliğe kadar geri alınabilir
- **Otomatik kayıt:** 5 saniye hareketsizlik sonrası değişiklikler otomatik kaydedilir
- **AI Sınıflandırma paneli:** Notları AI ile analiz edip kategorilere atar, sonuçları kaydeder
- Aktif AI işini iptal etme, kaldığı yerden devam etme

---

### 7. Bağış Havuzu `/bagis-havuzu/:id`

En kapsamlı sayfa. Projeye ait tüm bağışların merkezi yönetim noktası.

**Veri Girişi — Import Sihirbazı:**
- Excel / CSV dosyası yüklenir
- Kolonlar eşleştirilir (hangi kolon = isim, hangi = tutar vb.)
- Tekrar/çakışma uyarıları gösterilir
- Onaylandıktan sonra havuza eklenir

**Filtreleme (URL'e yansır, paylaşılabilir):**
- Metin arama
- Atama durumu (havuzda / atanmış / tümü)
- Bağış türü (çoklu seçim)
- Birim (çoklu)
- Temsilci (çoklu)
- Kesim alanı
- AI kategorisi
- Özellik etiketleri
- Fiyat
- Yer talebi

**Tablo:**
- Sanallaştırılmış (VirtualizedDonationTable) — binlerce kayıt yavaşlatmaz
- Kolonlar özelleştirilebilir
- Hücre üzerine tıklanarak anlık düzenleme
- Bağışçı "işaretle" (flag) — sorunlu listesine ekler

**Toplu İşlemler (seçili kayıtlara):**
- Etiket ekle/kaldır
- Toplu not ekle
- Kesim alanına aktar
- Sil
- Filtrelenenleri toplu sil

**AI Sınıflandırma (hızlı):**
- Doğrudan bu sayfadan AI başlatılabilir, sonuçlar anlık tabloya yansır

**Otomasyon Kuralları Paneli:**
- Kural tanımla: "Temsilci = X ise → Kesim Alanı Y'ye ata" gibi otomatik eşleştirme

**Transfer:**
- Seçili bağışları belirli bir kesim alanına toplu taşır
- Yeni kesim alanı da oluşturulabilir

**Dışa Aktarma:**
- Excel export (mevcut filtre uygulanmış haliyle)

---

### 8. AI Sınıflandırma `/bagis-havuzu/:id/ai`

Notu olan tüm bağışları AI ile otomatik kategorize eden özel sayfa.

**Nasıl çalışır:**
1. Notları olan bağışlar listelenir
2. Batch boyutu seçilir (5–50 bağış/istek)
3. "Başlat"a basılınca backend'e asenkron job gönderilir
4. Frontend 3 saniyede bir sonuçları sorgular (polling)
5. Sonuçlar anlık ekrana yansır
6. İşlem bitince otomatik kaydedilir

**Sol panel:**
- Batch boyutu seçimi
- "Daha önce sınıflandırılmışları atla" seçeneği
- İlerleme çubuğu (% ve sayı)
- Yeniden dene / kaldığı yerden devam / durdur butonları
- İstatistikler: işlenen, uyarı sayısı, özel istek, kategori çeşidi

**Sağ panel:**
- **Kategori Dağılımı:** Her kategoride kaç bağış var, tıklanarak filtrele
- **Uyarılı Bağışçılar:** AI'nın tespit ettiği tutarsızlıklar (örn: "Şafi mezhebine göre kesim gerekiyor")
- **Özel İstekler:** Aksiyon gerektiren talepler (örn: "Et bize gelsin")
- **Tüm Sonuçlar:** Bağışçı bazlı kategoriler ve özetler

---

### 9. Sorunlu Bağışlar `/sorunlu-bagislar/:id`

Dikkat gerektiren bağışların tek ekranda toplanması.

**3 kaynak:**
- **Manuel İşaretlenenler:** Havuz sayfasından elle flag'lenenler
- **AI Uyarıları:** AI'nın `warnings` alanına yazdığı uyarılar
- **Çakışmalar:** Aynı bağışçı aynı anda birden fazla hayvanla eşleşmiş

**Filtreleme:** Kaynak türü, kesim alanı, çözümlendi/çözülmedi durumu

---

### 10. Kesim Raporu `/rapor/:id`

Bir kesim alanının genel gidişatını gösterir (yazdırılabilir).

- Toplam hayvan / kesildi / bekliyor / doluluk oranı
- Toplam bağışçı / dolu hisse
- **Saatlik dağılım:** Hangi saatte kaç hayvan kesildi
- **Ekip istatistikleri:** Her ekibin toplam ve tamamlanan hayvanları

---

### 11. Kesim Takip `/takip/:token`

**Şifre gerektirmez.** Saha ekibine özel link — QR kod ile telefondan açılır.

**Özellikler:**
- Hayvan listesi: bekliyor / kesildi görünümü
- Tıklanarak "kesildi" olarak işaretlenir
- **Offline çalışma:** İnternet kesilirse değişiklikler kuyruğa alınır, bağlantı gelince senkronize edilir
- **Push Bildirimleri:** Yeni not veya durum değişikliğinde tarayıcı bildirimi
- **Yüksek Kontrast Modu:** Güneşli ortamda okunabilirlik için
- Hisse kağıdı overlay: bir hayvana tıklanınca detayları gösterir
- Özet rapor overlay: anlık istatistikler

---

### 12. Çöp Kutusu `/cop-kutusu`

Silinen projeler ve kesim alanları burada 90 gün bekler.

- Her kaydın içeriği genişletilerek görülebilir
- **Geri Yükle:** Kaydı aktif hale getirir
- **Kalıcı Sil:** 90 günü beklemeden anında temizler
- Toplu seçim ve toplu kalıcı silme

---

### 13. AI Prompt Ayarları `/ai-prompt-ayarlari`

AI sınıflandırma davranışını özelleştirme.

- **Kategori yönetimi:** Kategori ekle/sil (örn: yeni bir sınıf tanımla)
- **Prompt şablonu:** AI'ya gönderilen tam sistem talimatını düzenle
- `{{CATEGORIES}}` yer tutucusu otomatik kategori listesiyle değiştirilir
- Sıfırla butonu varsayılan ayarlara döner

---

### 14. API Dokümantasyon `/api-dokumantasyon`

Sistemin REST API'sinin interaktif dökümantasyonu. Dış entegrasyonlar veya otomasyon için kullanılabilecek endpoint'ler burada listeleniyor.

---

## Sistem Geneli Özellikler

| Özellik | Detay |
|---|---|
| Şifre koruması | Tüm sayfalar (takip hariç) şifre kapısı arkasında |
| Tema | Açık / Koyu / Sistem |
| Mobil uyum | Responsive, sidebar drawer ile mobilde çalışır |
| Offline destek | Saha takip sayfasında çevrimdışı kuyruklama |
| Yedekleme | JSON formatında tam yedek al/geri yükle |
| Denetim | Her işlem audit log'a kaydedilir |
| Soft delete | Silmeler 90 gün geri alınabilir |
| AI entegrasyonu | Replit AI proxy üzerinden GPT-5-mini kullanılıyor |
| Excel import/export | Havuz için import, her kesim için export |

---

## Teknik Yığın

| Katman | Teknoloji |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Routing | Wouter |
| Veri yönetimi | TanStack Query (React Query) |
| UI | Tailwind CSS v4, shadcn/ui |
| Backend | Express 5, TypeScript |
| ORM | Drizzle ORM |
| Veritabanı | PostgreSQL (uzak sunucu) |
| Paket yönetimi | pnpm monorepo |
| Loglama | Pino |
| AI | OpenAI GPT-5-mini (Replit proxy) |
| Sanallaştırma | Tablo satır sanallaştırma (VirtualizedDonationTable) |
