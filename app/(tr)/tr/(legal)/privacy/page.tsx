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
      <h1>Gizlilik Politikasi</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Topladigimiz veriler</h2>
      <p>Hesap bilgileri (e-posta), kredi paketi siparis kayitlari, uygulama
      kullanim kayitlari ve destek yazismalari. Odeme karti bilgileri tarafimizca
      saklanmaz; odeme islemleri Polar (satici kaydi, Merchant of Record) uzerinden yurutulur.</p>
      <h2>Kullanim amaci</h2>
      <p>Hizmetin sunulmasi, kredi paketlerinin satisi, guvenlik ve kotuye kullanimin
      onlenmesi, yasal yukumluluklerin yerine getirilmesi.</p>
      <h2>Ucuncu taraflar</h2>
      <p>Barindirma icin Vercel, veritabani ve kimlik dogrulama icin Supabase,
      odeme icin Polar, e-posta icin Resend hizmetlerinden yararlanilmaktadir. Bot dogrulamasi icin
      Cloudflare Turnstile (IP adresi ve tarayici sinyalleri), kotuye kullanim
      sayaclari icin Upstash (takma adli IP, yaklasik 1 saat icinde silinir; gunluk
      sayac yaklasik 2 gun tutulur) kullanilir.</p>
      <h2 id="hesap-ve-krediler">Hesap ve krediler</h2>
      <p>Karikatur atolyesini kullanmak icin Google ile veya e-posta ile gonderilen
      bir giris baglantisiyla (sifresiz) giris yapilir. Giris icin Google ve
      Supabase kullanilir; e-posta adresiniz ve hesap kimliginiz Supabase
      tarafinda tutulur. Giris e-postalari Resend uzerinden gonderilir. Hesabi
      ProToolHub isletir.</p>
      <p>Kredi ve donusum kayitlari tutulur: tarih, arac, stil ve kredi turu.
      Yuklediginiz gorsel bu kayitlara girmez ve saklanmaz. Ucretsiz hesaplarin
      kotuye kullanimini sinirlamak icin IP adresinizin ve cihaz kimliginizin
      anahtarli ozeti (hash) yaklasik iki gun tutulur, sonra silinir.</p>
      <p>Ucretsiz hos geldin kredisini alan her e-posta adresinin normallestirilmis
      halinin ozeti (hash) kalici olarak saklanir; hesap silinse de bu ozet
      silinmez. Tek amaci ayni e-posta adresine ikinci kez ucretsiz kredi
      verilmesini onlemektir; ozet hicbir hesaba bagli degildir ve e-posta adresinin
      kendisi bu kayitta tutulmaz.</p>
      <h2 id="odeme-ve-krediler">Ödeme ve krediler</h2>
      <p>Kredi paketlerinin ödemesini <strong>Polar</strong> (polar.sh) alır. Polar,
      satıcı kaydıdır (<strong>Merchant of Record</strong>): kart ve fatura bilgilerinizi
      kendi gizlilik politikası uyarınca işler, vergiyi ve faturayı da kendisi düzenler.
      Kart numaranızı biz görmüyoruz ve saklamıyoruz. Polar'a hesabınızın e-posta
      adresini ve hesap kimliğinizi iletiriz.</p>
      <p>Tarafımızda şunlar tutulur: Polar sipariş kimliği, paket, kredi sayısı, net
      tutar, para birimi, iade tutarları ve tarihleri. Bir iade sonrasında kredilerin
      bir kısmı geri alınamazsa operatöre bir uyarı e-postası gönderilir; bu e-posta
      <strong>Resend</strong> üzerinden gider ve yalnızca sipariş ile hesap kimliğini
      içerir, sizin e-posta adresinizi içermez. Bu kayıtlar hesabınız silindiğinde
      silinir; yalnızca Polar kimlikleri ve iade tutarlarından oluşan kayıtlar, bir
      kişiye bağlı olmadan kalır.</p>
      <p>Polar ve Resend verileri Türkiye dışında (yurt dışı) işlediği için bu veriler
      yurt dışına aktarılmış olur.</p>
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
      yükümlülükleri nedeniyle Polar sipariş ve iade kayıtları; bu ödeme kayıtları
      bir kişiye bağlı olmadan, yalnızca sipariş kimliği, tutar ve tarihlerle tutulur.</p>
      <h2 id="ucretsiz-hak-ozetleri">Ücretsiz hakkın özetleri</h2>
      <p>Ücretsiz hakkın aynı e-posta adresine ikinci kez verilmemesi için e-posta adresinizin SHA-256 özeti saklanır; adresin kendisi bu kayıtta tutulmaz. Bu özet, hesabınızı silseniz de silinmez.</p>
      <p>IP adresinizin ve cihazınızın gizli bir anahtarla alınmış özetleri (HMAC-SHA-256), ücretsiz hakkın günlük sınırları için 2 gün kullanılır ve sonra silinir. Silme, bu sürenin sonundan sonraki ilk ücretsiz hak talebinde otomatik olarak yapılır.</p>
      <p>Saatlik dönüşüm sınırı için IP adresinizin anahtarlı özeti Upstash'te en fazla yaklaşık bir saat (3700 saniye) tutulur.</p>
      <h2>Haklariniz</h2>
      <p>KVKK ve GDPR kapsaminda verilerinize erisme, duzeltme, silme ve isleme
      faaliyetine itiraz etme hakkina sahipsiniz. Talepleriniz icin iletisim
      sayfamizdaki adresleri kullanabilirsiniz.</p>
    </main>
  )
}
