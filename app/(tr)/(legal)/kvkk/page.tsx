import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'
import { LEGAL_ENTITY } from '@/lib/legal-entity'

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/kvkk', languages: { tr: '/tr/kvkk' } },
  openGraph: { url: '/tr/kvkk' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>KVKK Aydınlatma Metni</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Veri sorumlusunun kimliği</h2>
      <p>{LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}.</p>
      <h2>İşleme amaçları</h2>
      <p>Hesap oluşturma ve yönetimi, kredi paketlerinin satışı ve ödemenin
      alınması, destek taleplerinin karşılanması, güvenlik ve kötüye kullanımın önlenmesi, yasal
      yükümlülüklerin yerine getirilmesi. Yalnızca açık rızanızla ayrıca ziyaret ölçümü ve reklam performansı ölçümü yapılır.</p>
      <h2>Hukuki sebep</h2>
      <p>KVKK m.5/2-c uyarınca sözleşmenin kurulması ve ifası, m.5/2-ç uyarınca
      hukuki yükümlülüğün yerine getirilmesi ve m.5/2-f uyarınca meşru menfaat. Ölçüm ve reklam çerezleri için dayanak, KVKK m.5/1 uyarınca açık rızanızdır; rızanız olmadan bu çerezler yüklenmez.</p>
      <h2>Aktarım</h2>
      <p>Kişisel verileriniz, hizmetin sunulabilmesi amacıyla yurt dışında yerleşik
      şu hizmet sağlayıcılara aktarılmaktadır: barındırma için Vercel, veritabanı
      ve kimlik doğrulama için Supabase, ödeme için Stripe, e-posta gönderimi için
      Resend. Yüklediğiniz fotoğraf, karikatürü üretmek için ABD&apos;de yerleşik
      OpenAI&apos;a aktarılır; fotoğraf bizde saklanmaz. Ayrıca bot doğrulaması için Cloudflare Turnstile (IP adresi ve tarayıcı
      sinyalleri) ve kötüye kullanım sayaçları için Upstash (takma adlı IP, yaklaşık
      1 saat içinde silinir; günlük sayaç yaklaşık 2 gün tutulur) kullanılmaktadır. Yalnızca açık rıza vermeniz halinde ziyaret ölçümü için Google (Google Analytics ve Google Ads) ve Meta (Meta pikseli) araçları yüklenir ve bu araçların verileri ABD&apos;de yerleşik Google ve Meta tarafından işlenir; rıza vermezseniz bu aktarım yapılmaz.</p>
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
      <h2>Saklama süresi</h2>
      <p>Veriler, üyelik süresince ve üyeliğin sona ermesinden itibaren ilgili
      mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır.</p>
      <h2>İlgili kişinin hakları</h2>
      <p>KVKK m.11 uyarınca: verilerinizin işlenip işlenmediğini öğrenme, bilgi
      talep etme, işleme amacını öğrenme, düzeltilmesini veya silinmesini isteme,
      aktarıldığı üçüncü kişileri bilme ve zararın giderilmesini talep etme
      haklarına sahipsiniz.</p>
      <h2>Başvuru yöntemi</h2>
      <p>Taleplerinizi {LEGAL_ENTITY.address} adresine posta yoluyla veya {LEGAL_ENTITY.email} adresine
      e-posta ile iletebilirsiniz. Başvurunuz en geç otuz gün içinde
      sonuçlandırılır.</p>
    </main>
  )
}
