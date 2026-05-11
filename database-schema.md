# Veritabanı Şeması Dokümantasyonu

Bu belge, uygulamanın PostgreSQL veritabanındaki tüm tabloları, tuttukları verileri ve birbirleriyle ilişkilerini açıklamaktadır. ORM olarak **Drizzle ORM** kullanılmaktadır.

---

## Genel Bakış

Uygulamanın temel iş akışı şu hiyerarşi üzerine kuruludur:

```
Project (Proje)
  └── KesimAlani (Kesim Alanı)
        ├── Donation (Bağışçı / Hisse)
        │     └── CustomTag (Etiket) [M:N]
        ├── AnimalGroup (Hayvan Grubu)
        │     ├── Donation [M:N via animal_group_donations]
        │     ├── TrackingNote (Takip Notu)
        │     ├── AnimalGroupPhoto (Fotoğraf)
        │     └── NotificationLog (Bildirim Kaydı)
        └── Team (Ekip)
              └── AnimalGroup [1:N]
```

---

## Tablolar

### 1. `projects` — Projeler

Her kurban kampanyasını veya yılını temsil eder. Her şey bir projeye bağlıdır.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `name` | text | Proje adı (örn. "Kurban 2025") |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |
| `deleted_at` | timestamp | Soft delete; dolu ise proje silinmiş sayılır |
| `archived_at` | timestamp | Arşivlenme zamanı; dolu ise proje arşivdedir |

---

### 2. `kesim_alanlari` — Kesim Alanları

Bir projeye bağlı, bağımsız kurban kesim bölgelerini temsil eder. Bağışçılar, hayvan grupları ve ekipler doğrudan bu tabloya bağlıdır.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `project_id` | text (FK → projects) | Hangi projeye ait olduğu |
| `name` | text | İç kullanım adı (slug benzeri) |
| `display_name` | text | Görüntüleme adı |
| `yetkili` | text | Sorumlu kişi adı |
| `max_vekalet` | integer | İzin verilen maksimum vekalet sayısı |
| `max_animal` | integer | Maksimum hayvan sayısı limiti |
| `tracking_token` | text | Herkese açık takip sayfasına erişim tokeni |
| `tracking_token_expires_at` | timestamp | Takip tokeninin geçerlilik süresi |
| `kesim_liste_id` | text | Dış sistemle eşleştirme için ID (VYS vb.) |
| `parent_kesim_alani_id` | text (FK → kesim_alanlari) | Bölünme işlemlerinde kaynak alanı işaret eder (self-reference) |
| `split_status` | text | Bölünme durumu (`split`, `merged`, vb.) |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |
| `deleted_at` | timestamp | Soft delete |

---

### 3. `donations` — Bağışçılar / Hisseler

Bir kesim alanına kayıtlı her bir hisseyi/bağışçıyı temsil eder. Uygulamanın en merkezi tablosudur.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text (FK → kesim_alanlari) | Hangi kesim alanına ait olduğu |
| `name` | text | Bağışçı adı |
| `description` | text | Açıklama / kurban niyeti |
| `phone` | text | Telefon numarası |
| `share_count` | integer | Hisse sayısı (default: 1) |
| `donation_type` | text | Kurban türü (büyükbaş, küçükbaş vb.) |
| `vekalet` | text | Vekalet bilgisi |
| `notes` | text | Ek notlar |
| `birim` | text | Kayıtlı olduğu birim/kurum |
| `temsilci` | text | Temsilci adı |
| `ozellik` | text | Özellik/kısıtlama bilgisi |
| `fiyat` | text | Hisse fiyatı |
| `yer_talebi` | text | Belirli bir kesim yeri talebi |
| `gun_talebi` | text | Belirli bir gün talebi |
| `ilk_hayvan` | text | İlk hayvan tercihi |
| `safi` | text | Safi et talebi vb. |
| `excluded` | boolean | Gruplama dışı bırakılmış mı? (default: false) |
| `sort_order` | integer | Listeleme sırası |
| `is_flagged` | boolean | İşaretlenmiş/çakışma var mı? |
| `flag_reason` | text | İşaretlenme sebebi |
| `flag_resolved_at` | timestamp | İşaretin çözüldüğü zaman |
| `ai_categories` | text | AI tarafından atanan kategoriler |
| `ai_warnings` | text | AI uyarıları |
| `ai_requests` | text | AI'ın tespit ettiği talepler |
| `ai_summary` | text | AI özet metni |
| `updated_at` | timestamp | Son güncellenme zamanı |
| `deleted_at` | timestamp | Soft delete |

---

### 4. `teams` — Ekipler

Bir kesim alanı içindeki kesim ekiplerini tanımlar. Hayvan grupları bir ekibe atanabilir.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text (FK → kesim_alanlari) | Hangi kesim alanına ait olduğu |
| `name` | text | Ekip adı |
| `color` | text | Ekip rengi (hex, default: #3b82f6) |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 5. `animal_groups` — Hayvan Grupları

Bir kesim alanında oluşturulan hayvan gruplarını temsil eder. Her grup, birden fazla hisseyi (donation) barındırır.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text (FK → kesim_alanlari) | Hangi kesim alanına ait olduğu |
| `team_id` | text (FK → teams) | Atandığı ekip |
| `animal_no` | integer | Hayvan numarası |
| `color_tag` | text | Renk etiketi |
| `locked` | boolean | Kilitli mi? (kilitliyse otomatik yeniden gruplama yapılmaz) |
| `notes` | text | Grup notları |
| `sort_order` | integer | Listeleme sırası |
| `kesildi` | boolean | Kesildi mi? |
| `kesildi_at` | timestamp | Kesilme zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |
| `deleted_at` | timestamp | Soft delete |

---

### 6. `animal_group_donations` — Hayvan Grubu ↔ Bağışçı İlişkisi

`animal_groups` ve `donations` tabloları arasındaki çoka-çok (M:N) ilişkiyi yöneten bağlantı tablosudur.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial (PK) | Otomatik artan ID |
| `group_id` | text (FK → animal_groups) | Hayvan grubu |
| `donation_id` | text (FK → donations) | Bağışçı/hisse |
| `sort_order` | integer | Grup içi sıralama |
| `updated_at` | timestamp | Son güncellenme zamanı |

> **Kısıt:** `(group_id, donation_id)` çifti benzersizdir — bir bağışçı aynı gruba iki kez eklenemez.

---

### 7. `custom_tags` — Özel Etiketler

Bağışçılara atanabilecek özelleştirilebilir etiketleri tanımlar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `name` | text | Etiket adı |
| `color` | text | Etiket rengi (hex, default: #3b82f6) |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 8. `donation_tags` — Bağışçı ↔ Etiket İlişkisi

`donations` ve `custom_tags` arasındaki M:N ilişkiyi yöneten bağlantı tablosudur.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial (PK) | Otomatik artan ID |
| `donation_id` | text (FK → donations) | Bağışçı |
| `tag_id` | text (FK → custom_tags) | Etiket |
| `updated_at` | timestamp | Son güncellenme zamanı |

> **Kısıt:** `(donation_id, tag_id)` çifti benzersizdir.

---

### 9. `tracking_notes` — Takip Notları

Bir hayvan grubuna bağlı durum güncellemelerini ve manuel notları kaydeder. Halka açık takip ekranında gösterilir.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text (FK → kesim_alanlari) | İlgili kesim alanı |
| `animal_group_id` | text (FK → animal_groups) | İlgili hayvan grubu (opsiyonel) |
| `type` | text | Not türü (`note`, `status_change`, vb.) |
| `content` | text | Not içeriği |
| `field_name` | text | Değiştirilen alan adı (durum değişikliği için) |
| `old_value` | text | Önceki değer |
| `new_value` | text | Yeni değer |
| `status` | text | Not durumu (default: `pending`) |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |
| `deleted_at` | timestamp | Soft delete |

---

### 10. `animal_group_photos` — Hayvan Fotoğrafları

Hayvan gruplarına ait fotoğrafları base64 formatında saklar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `animal_group_id` | text (FK → animal_groups) | İlgili hayvan grubu |
| `data` | text | Fotoğraf verisi (base64) |
| `thumbnail` | text | Küçük önizleme görseli (base64) |
| `mime_type` | text | Dosya türü (default: `image/jpeg`) |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 11. `notification_logs` — Bildirim Kayıtları

Bağışçılara gönderilen WhatsApp/SMS bildirimlerinin geçmişini tutar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text (FK → kesim_alanlari) | İlgili kesim alanı |
| `animal_group_id` | text (FK → animal_groups) | İlgili hayvan grubu (opsiyonel) |
| `animal_no` | integer | Hayvan numarası (snapshot) |
| `donor_name` | text | Bağışçı adı (snapshot) |
| `phone` | text | Gönderim yapılan telefon numarası |
| `message` | text | Gönderilen mesaj içeriği |
| `channel` | text | Kanal (default: `browser`; `whatsapp`, `sms` vb.) |
| `created_at` | timestamp | Gönderim zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 12. `donation_transfers` — Bağışçı Transferleri

Bir bağışçının/hissenin bir kesim alanından diğerine taşınma kayıtlarını tutar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `project_id` | text (FK → projects) | İlgili proje |
| `donation_id` | text | Transfer edilen bağışçının ID'si (soft ref, silinirse null kalır) |
| `donor_name` | text | Bağışçı adı (snapshot) |
| `donor_description` | text | Bağışçı açıklaması (snapshot) |
| `from_kesim_alani_id` | text | Kaynak kesim alanı ID |
| `from_kesim_alani_name` | text | Kaynak kesim alanı adı (snapshot) |
| `to_kesim_alani_id` | text | Hedef kesim alanı ID |
| `to_kesim_alani_name` | text | Hedef kesim alanı adı (snapshot) |
| `removed_from_source` | boolean | Kaynaktan silindi mi? (default: true) |
| `share_count` | integer | Transfer edilen hisse sayısı |
| `transfer_type` | text | Transfer türü (default: `donation`) |
| `animal_group_id` | text | Hayvan grubu ID (hayvan transferleri için) |
| `animal_no` | integer | Hayvan numarası (snapshot) |
| `created_at` | timestamp | Transfer zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 13. `automation_rules` — Otomasyon Kuralları

Bir proje için tanımlanmış koşullu otomasyon kurallarını saklar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `project_id` | text (FK → projects) | İlgili proje |
| `name` | text | Kural adı |
| `conditions` | jsonb | Koşullar dizisi (JSON) |
| `action` | jsonb | Yapılacak işlem (JSON) |
| `priority` | integer | Öncelik sırası |
| `is_active` | boolean | Kural aktif mi? |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 14. `ai_jobs` — AI İşlemleri

Arka planda çalışan AI analiz görevlerinin durumunu takip eder.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | text (PK) | Benzersiz kimlik |
| `kesim_alani_id` | text | İşlemin yapıldığı kesim alanı |
| `status` | text | Durum (`pending`, `running`, `done`, `error`) |
| `total_donations` | integer | Toplam işlenecek bağışçı sayısı |
| `processed_donations` | integer | Şimdiye kadar işlenen sayı |
| `result` | text | Sonuç mesajı |
| `error` | text | Hata mesajı |
| `expires_at` | timestamp | Kaydın geçerlilik süresi |
| `created_at` | timestamp | Oluşturulma zamanı |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 15. `audit_logs` — Denetim Kayıtları

Sistem genelindeki önemli değişikliklerin izini tutar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial (PK) | Otomatik artan ID |
| `action` | text | Yapılan işlem (`create`, `update`, `delete`, vb.) |
| `entity_type` | text | Etkilenen varlık türü (`donation`, `animal_group`, vb.) |
| `entity_id` | text | Etkilenen kaydın ID'si |
| `entity_name` | text | Etkilenen kaydın adı |
| `old_value` | jsonb | İşlem öncesi değer |
| `new_value` | jsonb | İşlem sonrası değer |
| `source_type` | text | Değişikliğin kaynağı (`system`, `user`, `api`, vb.) |
| `source_identifier` | text | Kaynak tanımlayıcı |
| `ip_address` | text | İşlemi yapan IP adresi |
| `created_at` | timestamp | İşlem zamanı |

---

### 16. `app_settings` — Uygulama Ayarları

Uygulama genelindeki yapılandırma değerlerini key-value formatında saklar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `key` | text (PK) | Ayar anahtarı |
| `value` | text | Ayar değeri |
| `updated_at` | timestamp | Son güncellenme zamanı |

---

### 17. `conversations` — Konuşmalar

AI sohbet özelliği için konuşma oturumlarını tutar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial (PK) | Otomatik artan ID |
| `title` | text | Konuşma başlığı |
| `created_at` | timestamp | Oluşturulma zamanı |

---

### 18. `messages` — Mesajlar

Bir konuşmaya ait bireysel mesajları saklar.

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial (PK) | Otomatik artan ID |
| `conversation_id` | integer (FK → conversations) | İlgili konuşma |
| `role` | text | Mesajı gönderen (`user`, `assistant`) |
| `content` | text | Mesaj içeriği |
| `created_at` | timestamp | Oluşturulma zamanı |

---

## İlişki Özeti

```
projects ──────────────────────────────── 1:N ── kesim_alanlari
projects ──────────────────────────────── 1:N ── donation_transfers
projects ──────────────────────────────── 1:N ── automation_rules

kesim_alanlari ────────────────────────── 1:N ── donations
kesim_alanlari ────────────────────────── 1:N ── animal_groups
kesim_alanlari ────────────────────────── 1:N ── teams
kesim_alanlari ────────────────────────── 1:N ── tracking_notes
kesim_alanlari ────────────────────────── 1:N ── notification_logs
kesim_alanlari ──────────── self-ref ──── 1:N ── kesim_alanlari (parent/child bölünme)

animal_groups ─────────────────────────── 1:N ── tracking_notes
animal_groups ─────────────────────────── 1:N ── animal_group_photos
animal_groups ─────────────────────────── 1:N ── notification_logs

teams ─────────────────────────────────── 1:N ── animal_groups

donations ──── animal_group_donations ─── M:N ── animal_groups
donations ──── donation_tags ──────────── M:N ── custom_tags

conversations ─────────────────────────── 1:N ── messages
```

---

## Soft Delete Politikası

Aşağıdaki tablolar fiziksel silme yerine `deleted_at` kolonunu doldurarak soft delete uygular:

- `projects`
- `kesim_alanlari`
- `donations`
- `animal_groups`
- `tracking_notes`

Sorgu yazarken aktif kayıtları almak için `WHERE deleted_at IS NULL` koşulunu eklemeyi unutmayın.

---

## Snapshot Kolonları

`donation_transfers` ve `notification_logs` tablolarındaki bazı kolonlar (`donor_name`, `from_kesim_alani_name`, `animal_no` vb.) kayıt sırasındaki veri anlık görüntüsünü (snapshot) saklar. Bu sayede kaynak kayıt silinse veya değişse bile transfer/bildirim geçmişi bozulmaz.
