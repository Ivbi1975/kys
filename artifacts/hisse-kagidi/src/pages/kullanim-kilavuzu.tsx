import { useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, LogIn, Home, Layers,
  Scissors, Printer, Tag, Brain, Trash2, Search, Package,
  Smartphone, AlertTriangle, CheckCircle,
  Info, ArrowRight, Star
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/8 border border-primary/15 mt-3">
      <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-white/60 leading-relaxed">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/8 border border-yellow-500/15 mt-3">
      <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-white/60 leading-relaxed">{children}</p>
    </div>
  );
}

function Step({ no, title, children }: { no: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 mt-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-primary mt-0.5">
        {no}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white/80">{title}</p>
        {children && <div className="text-[12.5px] text-white/50 mt-0.5 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

function Section({
  id, icon, title, badge, children
}: {
  id: string; icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white/3 hover:bg-white/5 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-primary/70">{icon}</span>
          <span className="font-semibold text-white/85 text-[14px]">{title}</span>
          {badge && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/8 text-[10px] ml-1">
              {badge}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 py-5 space-y-5 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/35">{title}</h3>
      {children}
    </div>
  );
}

function TableOfContents() {
  const items = [
    { id: "giris", label: "Giriş Yapma" },
    { id: "ana-sayfa", label: "Ana Sayfa ve Projeler" },
    { id: "bagis-havuzu", label: "Bağış Havuzu" },
    { id: "kesim-listesi", label: "Kesim Listesi Yönetimi" },
    { id: "hayvan-gruplari", label: "Hayvan Grupları" },
    { id: "kesim-takip", label: "Saha Takip Ekranı" },
    { id: "yazdir-aktar", label: "Yazdırma ve Dışa Aktarma" },
    { id: "etiketler", label: "Etiketler ve Filtreler" },
    { id: "ai", label: "Yapay Zekâ Sınıflandırma" },
    { id: "cop-kutusu", label: "Çöp Kutusu" },
  ];
  return (
    <div className="rounded-xl border border-white/8 bg-white/2 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mb-3">İçindekiler</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {items.map((item, i) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={e => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-2 text-[12.5px] text-white/50 hover:text-primary/80 transition-colors py-0.5"
          >
            <ArrowRight className="h-3 w-3 flex-shrink-0" />
            <span>{i + 1}. {item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function KullanimKilavuzu() {
  return (
    <div className="min-h-screen bg-[hsl(224,50%,6%)] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Başlık */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Kullanım Kılavuzu</h1>
              <p className="text-[12px] text-white/35">KYS — Kurban Yönetim Sistemi · İlk kez kullananlar için</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/8 text-[11px]">
              Adım Adım
            </Badge>
            <Badge variant="outline" className="text-white/40 border-white/15 text-[11px]">
              Türkçe
            </Badge>
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed max-w-2xl">
            Bu kılavuz, KYS'yi ilk kez kullananlar için hazırlanmıştır. Her bölüm,
            uygulamanın farklı bir özelliğini adım adım açıklar. Soldan istediğiniz
            konuya atlayabilir ya da sırayla okuyabilirsiniz.
          </p>
        </div>

        <TableOfContents />

        {/* 1. Giriş Yapma */}
        <Section id="giris" icon={<LogIn className="h-4 w-4" />} title="Giriş Yapma">
          <SubSection title="Nasıl giriş yaparım?">
            <Step no={1} title="Siteyi açın">
              Tarayıcınızda KYS'nin adresine gidin. Karşınıza şifre ekranı çıkacaktır.
            </Step>
            <Step no={2} title="Şifreleri girin">
              Yöneticinizin size verdiği şifreleri ilgili alanlara yazın.
              İki ayrı şifre alanı bulunur: birinci şifre uygulamaya giriş için, ikincisi ek güvenlik içindir.
            </Step>
            <Step no={3} title="Giriş Yap düğmesine tıklayın">
              Doğru girildiyse otomatik olarak ana sayfaya yönlendirilirsiniz.
              Oturumunuz uzun süre açık kalır; tarayıcıyı kapatsanız bile tekrar şifre girmeniz gerekmez.
            </Step>
            <Tip>
              Şifrenizi unuttuysanız sunucu yöneticinizle iletişime geçin.
              Şifre sıfırlama sayfası bulunmamaktadır.
            </Tip>
          </SubSection>
        </Section>

        {/* 2. Ana Sayfa ve Projeler */}
        <Section id="ana-sayfa" icon={<Home className="h-4 w-4" />} title="Ana Sayfa ve Projeler">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Ana sayfa, tüm organizasyonun merkezi noktasıdır. Burada <strong className="text-white/70">projeler</strong> ve
            her projeye bağlı <strong className="text-white/70">kesim listeleri</strong> listelenir.
          </p>

          <SubSection title="Yeni proje oluşturma">
            <Step no={1} title='Sağ üstteki "Yeni Proje" düğmesine tıklayın' />
            <Step no={2} title="Projeye bir isim verin (örn. 2025 Kurban Organizasyonu)" />
            <Step no={3} title="Oluştur'a tıklayın — proje listede belirecektir" />
          </SubSection>

          <SubSection title="Proje işlemleri">
            <p className="text-[12.5px] text-white/50">Proje kartının üzerindeki üç nokta menüsünden şunları yapabilirsiniz:</p>
            <div className="mt-2 space-y-1.5">
              {[
                ["Düzenle", "Proje adını değiştirin"],
                ["Arşivle", "Projeyi aktif listeden gizleyin (veriler silinmez)"],
                ["Sil", "Projeyi çöp kutusuna taşıyın (geri alınabilir)"],
              ].map(([action, desc]) => (
                <div key={action} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[12.5px] text-white/55"><strong className="text-white/70">{action}:</strong> {desc}</span>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Global arama">
            <Step no={1} title='Sağ üstteki büyüteç simgesine tıklayın veya Ctrl+K tuşlarına basın' />
            <Step no={2} title="İsim, vekalet numarası veya bağışçı adıyla arama yapın">
              Tüm projeler ve listeler aynı anda aranır.
            </Step>
          </SubSection>

          <SubSection title="Sol kenar çubuğu (Sidebar)">
            <p className="text-[12.5px] text-white/50">
              Ekranın solunda yer alan çubuk, aktif projeleri ve her projenin kesim listelerini gösterir.
              Bir projenin yanındaki oka tıklayarak listelerini genişletebilirsiniz.
              Mobil cihazlarda sol üstteki menü düğmesiyle açılır.
            </p>
          </SubSection>
        </Section>

        {/* 3. Bağış Havuzu */}
        <Section id="bagis-havuzu" icon={<Package className="h-4 w-4" />} title="Bağış Havuzu">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Bağış Havuzu, bir projeye ait tüm bağışçıların toplandığı merkezi alandır.
            Kesim listelerine atanmamış bağışçılar burada bekler.
            <strong className="text-white/70"> Temel iş akışı:</strong> önce bağışçılar havuza eklenir, ardından kesim listelerine dağıtılır.
          </p>

          <SubSection title="Bağışçı ekleme">
            <Step no={1} title='Proje sayfasındaki "Havuz" sekmesine veya sol menüdeki havuz simgesine tıklayın' />
            <Step no={2} title='"Yeni Bağışçı" düğmesiyle tek tek ekleyin ya da Excel/CSV ile toplu içe aktarın'>
              Toplu içe aktarma için sütun eşleştirme sihirbazı otomatik olarak açılır.
            </Step>
            <Step no={3} title="Her bağışçı için doldurulan alanlar:">
              <div className="mt-1.5 space-y-1">
                {[
                  ["Ad / Soyad", "Adına kurban kesilen kişi"],
                  ["Vekalet Veren", "Vekaleti düzenleyen kişi (description alanı)"],
                  ["Vekalet No", "Vekalet belgesi numarası"],
                  ["Hisse Sayısı", "Kaç hisse olduğu (varsayılan: 1)"],
                  ["Kurban Cinsi", "Vacip, Adak, Mevta vb."],
                  ["Not", "Serbest not alanı (AI analiz edebilir)"],
                ].map(([field, desc]) => (
                  <div key={field} className="flex items-start gap-2">
                    <span className="font-mono text-[11px] text-primary/70 w-24 flex-shrink-0 mt-0.5">{field}</span>
                    <span className="text-[12px] text-white/45">{desc}</span>
                  </div>
                ))}
              </div>
            </Step>
          </SubSection>

          <SubSection title="Excel / CSV ile toplu içe aktarma">
            <Step no={1} title='"Toplu İçe Aktar" düğmesine tıklayın' />
            <Step no={2} title="Dosyanızı sürükleyin veya seçin (xlsx, xls, csv)" />
            <Step no={3} title="Sütun eşleştirme ekranında hangi sütunun hangi alana karşılık geldiğini belirleyin" />
            <Step no={4} title="Önizlemeyi kontrol edin ve İçe Aktar'a tıklayın" />
            <Warning>
              İçe aktarmadan önce dosyanızdaki sütun başlıklarının doğru olduğundan emin olun.
              Hatalı eşleştirme veriyi bozabilir.
            </Warning>
          </SubSection>

          <SubSection title="Filtreleme ve arama">
            <p className="text-[12.5px] text-white/50">
              Üst kısımdaki filtre çubuğuyla bağışçıları şunlara göre daraltabilirsiniz:
              kurban cinsi, etiket, temsilci, fiyat, yer veya gün talebi, atanma durumu.
              Filtreler birleştirilebilir.
            </p>
          </SubSection>

          <SubSection title="Toplu işlemler">
            <p className="text-[12.5px] text-white/50">
              Birden fazla bağışçıyı seçerek (checkbox) şu işlemleri yapabilirsiniz:
            </p>
            <div className="mt-2 space-y-1.5">
              {[
                "Kesim listesine aktar",
                "Etiket ekle / kaldır",
                "Toplu not ekle",
                "Seçilenleri sil",
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-[12.5px] text-white/55">{item}</span>
                </div>
              ))}
            </div>
          </SubSection>
        </Section>

        {/* 4. Kesim Listesi */}
        <Section id="kesim-listesi" icon={<Layers className="h-4 w-4" />} title="Kesim Listesi Yönetimi">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Kesim listeleri, fiziksel kesim alanlarına veya gruplara karşılık gelir.
            Her liste kendi bağışçı ve hayvan gruplarına sahiptir.
          </p>

          <SubSection title="Yeni kesim listesi oluşturma">
            <Step no={1} title="Proje detay sayfasına gidin (proje adına tıklayın)" />
            <Step no={2} title='"Yeni Liste" düğmesine tıklayın' />
            <Step no={3} title="Listeye bir isim ve isteğe bağlı kapasite girin" />
            <Tip>
              Kapasite, listeye kaç hayvanlık grup eklenebileceğini sınırlar.
              Boş bırakırsanız sınırsız olur.
            </Tip>
          </SubSection>

          <SubSection title="Kesim listesi ekranı">
            <p className="text-[12.5px] text-white/50">
              Bir kesim listesine tıkladığınızda iki panelli ekran açılır:
            </p>
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border border-white/8 bg-white/2 px-4 py-3">
                <p className="text-[12.5px] font-medium text-white/70 mb-1">Sol Panel — Bağışçı Listesi</p>
                <p className="text-[12px] text-white/45">
                  Bu listedeki tüm bağışçılar görünür. Filtreleme, sıralama ve bireysel düzenleme yapılabilir.
                </p>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/2 px-4 py-3">
                <p className="text-[12.5px] font-medium text-white/70 mb-1">Sağ Panel — Hayvan Grupları</p>
                <p className="text-[12px] text-white/45">
                  Her kart bir hayvana karşılık gelir. İçinde o hayvana atanmış bağışçılar sıralanır.
                </p>
              </div>
            </div>
          </SubSection>

          <SubSection title="Listeyi bölme (Split)">
            <Step no={1} title="Proje detay sayfasında listenin üç nokta menüsünü açın" />
            <Step no={2} title='"Listeyi Böl" seçeneğine tıklayın' />
            <Step no={3} title="Kaç parçaya bölüneceğini veya hangi kriterlere göre ayrılacağını belirleyin" />
          </SubSection>
        </Section>

        {/* 5. Hayvan Grupları */}
        <Section id="hayvan-gruplari" icon={<Scissors className="h-4 w-4" />} title="Hayvan Grupları">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Hayvan grupları, bir kesim listesindeki her bir hayvana karşılık gelir.
            Genellikle 7 hisselik büyükbaş veya 1 hisselik küçükbaş olarak düzenlenir.
          </p>

          <SubSection title="Otomatik gruplama">
            <Step no={1} title='Kesim listesi ekranında "Otomatik Grupla" düğmesine tıklayın' />
            <Step no={2} title="Gruplama motoru, bağışçıları ortak özelliklere göre otomatik olarak hayvanlar arasında dağıtır">
              Aynı temsilciden gelenler, aynı kurban cinsindekiler veya özel istekler dikkate alınır.
            </Step>
            <Step no={3} title="Sonucu gözden geçirin ve beğenmediğiniz atamalar için sürükle-bırak ile düzenleyin" />
            <Tip>
              Otomatik gruplama yalnızca atanmamış bağışçılara uygulanır.
              Zaten atanmış bağışçılar yerinden kaldırılmaz.
            </Tip>
          </SubSection>

          <SubSection title="Manuel atama (sürükle-bırak)">
            <Step no={1} title="Sol paneldeki bağışçı kartını tutun" />
            <Step no={2} title="Sağ paneldeki hedef hayvan grubunun üzerine sürükleyin ve bırakın" />
            <Tip>
              Mobil cihazlarda sürükle-bırak yerine bağışçıyı seçip "Gruba Taşı" seçeneğini kullanabilirsiniz.
            </Tip>
          </SubSection>

          <SubSection title="Akıllı Yerleştirme">
            <Step no={1} title='Bir bağışçıyı seçin ve "Akıllı Yerleştir" düğmesine tıklayın' />
            <Step no={2} title="Sistem, bağışçıya en uygun hayvan grubunu otomatik olarak bulur ve önerir" />
            <Step no={3} title="Öneriyi kabul edin veya farklı bir grup seçin" />
          </SubSection>

          <SubSection title="Grup işlemleri">
            <p className="text-[12.5px] text-white/50">Her hayvan kartında yapabilecekleriniz:</p>
            <div className="mt-2 space-y-1.5">
              {[
                ["Renk Etiketi", "Hayvana görsel bir renk kodu atayın"],
                ["Not", "Gruba serbest not ekleyin"],
                ["Kilitle", "Grubu otomatik gruplamadan koruyun"],
                ["Sil", "Grubu ve atamalarını kaldırın"],
              ].map(([action, desc]) => (
                <div key={action} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[12.5px] text-white/55"><strong className="text-white/70">{action}:</strong> {desc}</span>
                </div>
              ))}
            </div>
          </SubSection>
        </Section>

        {/* 6. Saha Takip */}
        <Section id="kesim-takip" icon={<Smartphone className="h-4 w-4" />} title="Saha Takip Ekranı" badge="Sahaya özel">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Saha takip ekranı, kesim alanındaki görevlilerin kullanımı için tasarlanmıştır.
            Şifre gerektirmez; bunun yerine yalnızca o listeye özel bir bağlantı (link) ile açılır.
          </p>

          <SubSection title="Takip bağlantısı oluşturma">
            <Step no={1} title="Kesim listesi ekranında sağ üstteki Paylaş / Takip simgesine tıklayın" />
            <Step no={2} title='"Takip Bağlantısı Oluştur" seçeneğini seçin' />
            <Step no={3} title="Oluşturulan bağlantıyı kopyalayın ve saha görevlilerine gönderin" />
            <Warning>
              Bu bağlantıya sahip herkes o listeyi görüntüleyip kesim durumunu güncelleyebilir.
              Linki yalnızca güvendiğiniz kişilerle paylaşın.
              Gerekirse bağlantıyı iptal edip yeniden oluşturabilirsiniz.
            </Warning>
          </SubSection>

          <SubSection title="Kesim işaretleme">
            <Step no={1} title="Saha görevlisi takip linkini telefonda açar" />
            <Step no={2} title="Hayvan kartının üzerine tıklar" />
            <Step no={3} title='"Kesildi" düğmesine basar — kart anında yeşile döner' />
            <Tip>
              Takip ekranı çevrimdışı da çalışır. İnternet bağlantısı kesilse bile güncelleme yapılabilir;
              bağlantı gelince otomatik senkronize olur.
            </Tip>
          </SubSection>

          <SubSection title="Not ve fotoğraf ekleme">
            <Step no={1} title="Hayvan kartına tıklayın" />
            <Step no={2} title="Not ekleyin veya fotoğraf çekin / yükleyin" />
            <Step no={3} title="Kaydedilen notlar yönetim ekranında da görünür" />
          </SubSection>
        </Section>

        {/* 7. Yazdırma ve Dışa Aktarma */}
        <Section id="yazdir-aktar" icon={<Printer className="h-4 w-4" />} title="Yazdırma ve Dışa Aktarma">
          <SubSection title="Hisse kağıdı yazdırma">
            <Step no={1} title="Kesim listesi ekranında sağ üstteki Yazdır simgesine tıklayın" />
            <Step no={2} title="Şablon seçin:">
              <div className="mt-1.5 space-y-1">
                {[
                  ["Standart", "Tüm bilgilerle tam boyut"],
                  ["Dikey (Portrait)", "Dikey kağıt için optimize edilmiş"],
                  ["Kompakt", "Daha küçük puntoda, daha fazla kağıt tasarrufu"],
                  ["İsim Listesi", "Yalnızca isim ve vekalet bilgileri"],
                  ["Özet", "Sayısal özet ve istatistikler"],
                ].map(([name, desc]) => (
                  <div key={name} className="flex items-start gap-2">
                    <span className="font-mono text-[11px] text-primary/70 w-28 flex-shrink-0 mt-0.5">{name}</span>
                    <span className="text-[12px] text-white/45">{desc}</span>
                  </div>
                ))}
              </div>
            </Step>
            <Step no={3} title="Sütunları, yazı boyutunu ve QR kod seçeneğini ayarlayın" />
            <Step no={4} title="Tarayıcının yazdır diyaloğuyla kağıda veya PDF'e çıktı alın" />
          </SubSection>

          <SubSection title="Excel / CSV olarak dışa aktarma">
            <Step no={1} title="Bağış havuzu veya kesim listesi ekranında Dışa Aktar düğmesine tıklayın" />
            <Step no={2} title="Formatı seçin ve indirin" />
          </SubSection>

          <SubSection title="Tam yedek alma">
            <Step no={1} title="Sol menü veya ayarlar bölümünden Yedek Al seçeneğine gidin" />
            <Step no={2} title="Dışa Aktar düğmesiyle tüm sistem verisini JSON formatında indirin" />
            <Tip>
              Düzenli yedek almanız önerilir. Bu yedek dosyasıyla sistemi sıfırdan geri yükleyebilirsiniz.
            </Tip>
          </SubSection>
        </Section>

        {/* 8. Etiketler ve Filtreler */}
        <Section id="etiketler" icon={<Tag className="h-4 w-4" />} title="Etiketler ve Filtreler">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Etiketler, bağışçıları gruplamak ve hızlı filtreleme yapmak için kullanılır.
            Örneğin "VIP", "Sorunlu", "Kontrol Edilecek" gibi özel etiketler oluşturabilirsiniz.
          </p>

          <SubSection title="Etiket oluşturma">
            <Step no={1} title="Bağış havuzu ekranında Etiketler bölümüne gidin" />
            <Step no={2} title='"Yeni Etiket" düğmesine tıklayın' />
            <Step no={3} title="Etiket adı ve rengi belirleyin" />
          </SubSection>

          <SubSection title="Bağışçıya etiket atama">
            <Step no={1} title="Bağışçı satırının üzerine gelin ve düzenle simgesine tıklayın" />
            <Step no={2} title="Etiketler alanından istediğiniz etiketi seçin" />
            <Tip>
              Birden fazla bağışçıyı seçerek toplu etiket atayabilirsiniz.
            </Tip>
          </SubSection>

          <SubSection title="Filtreleme">
            <p className="text-[12.5px] text-white/50">
              Havuz veya liste ekranındaki filtre çubuğundan etiket, kurban cinsi, temsilci,
              atanma durumu ve daha fazlasına göre anlık filtreleme yapabilirsiniz.
              Filtreler birleştirilebilir ve kaydedilmez — sayfayı yenileyince sıfırlanır.
            </p>
          </SubSection>
        </Section>

        {/* 9. AI Sınıflandırma */}
        <Section id="ai" icon={<Brain className="h-4 w-4" />} title="Yapay Zekâ Sınıflandırma" badge="İsteğe bağlı">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Bağışçı notları çok çeşitli ve okunması güç olabilir. Yapay zekâ özelliği,
            notları otomatik olarak analiz ederek kategorilere ayırır ve sorunlu olanları işaretler.
          </p>

          <SubSection title="AI sınıflandırma çalıştırma">
            <Step no={1} title="Bağış havuzu ekranında veya not düzenleme sayfasında AI simgesine tıklayın" />
            <Step no={2} title="Sınıflandırılacak bağışçıları seçin (tümü veya seçili)" />
            <Step no={3} title='"Sınıflandır" düğmesine basın — işlem arka planda çalışır'>
              Büyük listelerde birkaç dakika sürebilir. Sayfayı kapatabilirsiniz, işlem devam eder.
            </Step>
            <Step no={4} title="Tamamlandığında bağışçılar otomatik olarak etiketlenir ve sorunlular işaretlenir" />
          </SubSection>

          <SubSection title="AI prompt ayarları">
            <Step no={1} title="Sol menüden AI Ayarları sayfasına gidin" />
            <Step no={2} title="Sistemin hangi kategorilerde sınıflandırma yapacağını ve nasıl yorumlayacağını düzenleyin" />
            <Warning>
              AI sınıflandırma bir yardımcı araçtır; sonuçları mutlaka gözden geçirin.
              Hatalı sınıflandırmalar olabilir.
            </Warning>
          </SubSection>
        </Section>

        {/* 10. Çöp Kutusu */}
        <Section id="cop-kutusu" icon={<Trash2 className="h-4 w-4" />} title="Çöp Kutusu">
          <p className="text-[13px] text-white/50 leading-relaxed">
            Silinen projeler ve kesim listeleri çöp kutusuna taşınır.
            Kalıcı olarak silinmeden önce geri yüklenebilirler.
          </p>

          <SubSection title="Silinen öğeyi geri yükleme">
            <Step no={1} title="Sol menünün alt kısmındaki Çöp Kutusu bağlantısına tıklayın" />
            <Step no={2} title="Geri yüklemek istediğiniz öğeyi bulun" />
            <Step no={3} title='"Geri Yükle" düğmesine tıklayın — öğe hemen aktif listeye döner' />
          </SubSection>

          <SubSection title="Kalıcı silme">
            <Step no={1} title="Çöp kutusu ekranında öğeyi seçin" />
            <Step no={2} title='"Kalıcı Sil" düğmesine tıklayın' />
            <Warning>
              Kalıcı silme geri alınamaz. İçindeki tüm bağışçılar, gruplar ve veriler de silinir.
              Bu işlemi yalnızca emin olduğunuzda yapın.
            </Warning>
          </SubSection>
        </Section>

        {/* Hızlı Başvuru */}
        <div className="rounded-xl border border-white/8 bg-white/2 px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <p className="text-[13px] font-semibold text-white/70">Hızlı Başvuru — Tipik İş Akışı</p>
          </div>
          <div className="space-y-2">
            {[
              "Proje oluştur",
              "Bağış Havuzu'na bağışçıları ekle (manuel veya Excel ile)",
              "Kesim listelerini oluştur ve bağışçıları listelere aktar",
              "Kesim listesi ekranında hayvan gruplarını oluştur",
              "Otomatik Grupla ile bağışçıları hayvanlara dağıt",
              "Gerekirse manuel düzenlemeler yap",
              "Hisse kağıtlarını yazdır",
              "Saha takip linkini oluştur ve görevlilere gönder",
              "Saha ekibi kesilen hayvanları işaretler",
              "Rapor ekranından durumu takip et",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-[12.5px] text-white/55">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 rounded-xl bg-white/2 border border-white/6">
          <Search className="h-4 w-4 text-white/25 flex-shrink-0" />
          <p className="text-[12.5px] text-white/40">
            Aradığınızı bulamadınız mı? Global arama özelliğini{" "}
            <span className="font-mono text-white/55">Ctrl+K</span> ile açıp
            bağışçı adı veya vekalet numarasıyla arama yapabilirsiniz.
          </p>
        </div>

      </div>
    </div>
  );
}
