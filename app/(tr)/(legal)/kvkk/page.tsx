import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/kvkk', languages: { tr: '/tr/kvkk' } },
  openGraph: { url: '/tr/kvkk' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>KVKK Aydinlatma Metni</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Veri sorumlusunun kimligi</h2>
      <p>DRAFT — NOT A REGISTERED ENTITY — REVIEW REQUIRED, DRAFT — REVIEW REQUIRED. MERSIS: DRAFT — NO MERSIS — REVIEW REQUIRED.</p>
      <h2>Isleme amaclari</h2>
      <p>Hesap olusturma ve yonetimi, kredi paketlerinin satisi ve odemenin
      alinmasi, destek taleplerinin karsilanmasi, guvenlik ve kotuye kullanimin onlenmesi, yasal
      yukumluluklerin yerine getirilmesi.</p>
      <h2>Hukuki sebep</h2>
      <p>KVKK m.5/2-c uyarinca sozlesmenin kurulmasi ve ifasi, m.5/2-c uyarinca
      hukuki yukumlulugun yerine getirilmesi ve m.5/2-f uyarinca mesru menfaat.</p>
      <h2>Aktarim</h2>
      <p>Kisisel verileriniz, hizmetin sunulabilmesi amaciyla yurt disinda yerlesik
      su hizmet saglayicilara aktarilmaktadir: barindirma icin Vercel, veritabani
      ve kimlik dogrulama icin Supabase, odeme icin Stripe, e-posta gonderimi icin
      Resend. Ayrica bot dogrulamasi icin Cloudflare Turnstile (IP adresi ve tarayici
      sinyalleri) ve kotuye kullanim sayaclari icin Upstash (takma adli IP, yaklasik
      1 saat icinde silinir; gunluk sayac yaklasik 2 gun tutulur) kullanilmaktadir.</p>
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
      <h2>Saklama suresi</h2>
      <p>Veriler, uyelik suresince ve uyeligin sona ermesinden itibaren ilgili
      mevzuatta ongorulen zamanasimi sureleri boyunca saklanir.</p>
      <h2>Ilgili kisinin haklari</h2>
      <p>KVKK m.11 uyarinca: verilerinizin islenip islenmedigini ogrenme, bilgi
      talep etme, isleme amacini ogrenme, duzeltilmesini veya silinmesini isteme,
      aktarildigi ucuncu kisileri bilme ve zararin giderilmesini talep etme
      haklarina sahipsiniz.</p>
      <h2>Basvuru yontemi</h2>
      <p>Taleplerinizi DRAFT — NO KEP — REVIEW REQUIRED adresine KEP uzerinden veya mavcimavci1983@gmail.com adresine
      e-posta ile iletebilirsiniz. Basvurunuz en gec otuz gun icinde
      sonuclandirilir.</p>
    </main>
  )
}
