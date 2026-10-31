import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/privacy', languages: { en: '/privacy', tr: '/tr/privacy', 'x-default': '/privacy' } },
  openGraph: { url: '/tr/privacy' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Gizlilik Politikası</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Topladığımız veriler</h2>
      <p>Hesap bilgileri (e-posta), kredi paketi sipariş kayıtları, uygulama
      kullanım kayıtları ve destek yazışmaları. Ödeme kartı bilgileri tarafımızca
      saklanmaz; ödeme işlemleri Stripe üzerinden yürütülür; satıcı AVC TRADE LLC'dir.</p>
      <h2>Kullanım amacı</h2>
      <p>Hizmetin sunulması, kredi paketlerinin satışı, güvenlik ve kötüye kullanımın
      önlenmesi, yasal yükümlülüklerin yerine getirilmesi.</p>
      <h2>Üçüncü taraflar</h2>
      <p>Barındırma için Vercel, veritabanı ve kimlik doğrulama için Supabase,
      ödeme için Stripe, e-posta için Resend hizmetlerinden yararlanılmaktadır. Yüklediğiniz fotoğraf,
      karikatürü üretmek için ABD&apos;de yerleşik OpenAI tarafından işlenir. Bot doğrulaması için
      Cloudflare Turnstile (IP adresi ve tarayıcı sinyalleri), kötüye kullanım
      sayaçları için Upstash (takma adlı IP, yaklaşık 1 saat içinde silinir; günlük
      sayaç yaklaşık 2 gün tutulur) kullanılır.</p>
      <h2 id="olcum">Ölçüm ve reklam</h2>
      <p>Yalnızca çerez bandında Kabul et derseniz, ziyaretleri ve reklamlarımızın işe yarayıp yaramadığını ölçmek için Google Analytics, Google Ads ve Meta (Meta pikseli) kullanılır. Rızanız olmadan hiçbiri yüklenmez. Bu araçlar verileri ABD&apos;de işler. Gönderilenler: ziyaret ettiğiniz sayfalar, cihaz ve tarayıcı bilgileri ile çerezlerinin ayarladığı çevrimiçi tanımlayıcılar; satın almada ayrıca tutar, para birimi ve sipariş kimliği. Adınız, e-posta adresiniz veya telefon numaranız gönderilmez. Rıza seçiminiz tarayıcınızda 12 ay boyunca saklanır, sonrasında bant yeniden sorar. Seçiminizi her sayfanın altındaki Çerez ayarları ile istediğiniz zaman değiştirebilirsiniz. Ayrıntılar için Çerez Politikası&apos;na bakın.</p>
      <h2 id="hesap-ve-krediler">Hesap ve krediler</h2>
      <p>Karikatür atölyesini kullanmak için Google ile veya e-posta ile gönderilen
      bir giriş bağlantısıyla (şifresiz) giriş yapılır. Giriş için Google ve
      Supabase kullanılır; e-posta adresiniz ve hesap kimliğiniz Supabase
      tarafında tutulur. Giriş e-postaları Resend üzerinden gönderilir. Hesabı
      ProToolHub işletir.</p>
      <p>Kredi ve dönüşüm kayıtları tutulur: tarih, araç, stil ve kredi türü.
      Yüklediğiniz görsel bu kayıtlara girmez ve saklanmaz. Ücretsiz hesapların
      kötüye kullanımını sınırlamak için IP adresinizin ve cihaz kimliğinizin
      anahtarlı özeti (hash) yaklaşık iki gün tutulur, sonra silinir.</p>
      <p>Ücretsiz hoş geldin kredisini alan her e-posta adresinin normalleştirilmiş
      halinin özeti (hash) kalıcı olarak saklanır; hesap silinse de bu özet
      silinmez. Tek amacı aynı e-posta adresine ikinci kez ücretsiz kredi
      verilmesini önlemektir; özet hiçbir hesaba bağlı değildir ve e-posta adresinin
      kendisi bu kayıtta tutulmaz.</p>
      <h2 id="odeme-ve-krediler">Ödeme ve krediler</h2>
      <p>Kredi paketlerinin ödemesini <strong>Stripe</strong> alır. Satıcı AVC TRADE LLC'dir; Stripe ödeme aracısıdır ve kart bilgilerinizi kendi gizlilik politikası uyarınca işler. Vergiyi <strong>Stripe Tax</strong> hesaplar ve fiyata dahildir. Biz kart numaranızı görmüyoruz ve saklamıyoruz. Stripe'a hesabınızın e-posta adresini ve hesap kimliğinizi iletiriz.</p>
      <p>Tarafımızda şunlar tutulur: Stripe sipariş (ödeme oturumu) ve ödeme kimlikleri, paket, kredi sayısı, ödenen tutar, vergi, para birimi, iade ve itiraz (chargeback) durumu ile tarihleri. Bir iade veya itiraz sonrasında kredilerin bir kısmı geri alınamazsa operatöre bir uyarı e-postası gönderilir; bu e-posta <strong>Resend</strong> üzerinden gider ve yalnızca ödeme ile hesap kimliğini içerir, sizin e-posta adresinizi içermez. Bu kayıtlar hesabınız silindiğinde silinir; yalnızca Stripe kimlikleri, tutarlar ve iade tutarlarından oluşan kayıtlar, bir kişiye bağlı olmadan kalır.</p>
      <p>Stripe ve Resend verileri Türkiye dışında (yurt dışı) işlediği için bu veriler yurt dışına aktarılmış olur.</p>
      <h2 id="hesap-silme">Hesabın silinmesi</h2>
      <p>Hesabınızı istediğiniz zaman Profil sayfasındaki "Hesabımı sil" düğmesiyle
      silebilirsiniz; işlem bir onay adımından sonra yapılır ve geri alınamaz.
      Silinenler: profiliniz, kalan tüm kredileriniz (ücretli krediler dahil), kredi ve
      dönüşüm geçmişiniz ve hoş geldin kaydınız. Giriş hesabınız ve e-posta adresiniz
      de silinir; ancak aynı giriş başka bir ProToolHub ürününde (Firma Bulucu)
      kullanılıyorsa yalnızca Karikatür Atölyesi kayıtlarınız silinir, giriş hesabınız
      o ürün için kalır.</p>
      <p>Kalanlar: ücretsiz kredinin aynı adrese ikinci kez verilmesini önlemek için
      e-posta adresinizin geri çevrilemez özeti (hash), ve vergi ile muhasebe
      yükümlülükleri nedeniyle Stripe ödeme ve iade kayıtları ile daha önceki Polar sipariş ve iade kayıtları; bu ödeme kayıtları
      bir kişiye bağlı olmadan, yalnızca ödeme kimliği, tutar ve tarihlerle tutulur.</p>
      <h2 id="ucretsiz-hak-ozetleri">Ücretsiz hakkın özetleri</h2>
      <p>Ücretsiz hakkın aynı e-posta adresine ikinci kez verilmemesi için e-posta adresinizin SHA-256 özeti saklanır; adresin kendisi bu kayıtta tutulmaz. Bu özet, hesabınızı silseniz de silinmez.</p>
      <p>IP adresinizin ve cihazınızın gizli bir anahtarla alınmış özetleri (HMAC-SHA-256), ücretsiz hakkın günlük sınırları için 2 gün kullanılır ve sonra silinir. Silme, bu sürenin sonundan sonraki ilk ücretsiz hak talebinde otomatik olarak yapılır.</p>
      <p>Saatlik dönüşüm sınırı için IP adresinizin anahtarlı özeti Upstash'te en fazla yaklaşık bir saat (3700 saniye) tutulur.</p>
      <h2>Haklarınız</h2>
      <p>KVKK ve GDPR kapsamında verilerinize erişme, düzeltme, silme ve işleme
      faaliyetine itiraz etme hakkına sahipsiniz. Talepleriniz için iletişim
      sayfamızdaki adresleri kullanabilirsiniz.</p>
    </main>
  )
}
