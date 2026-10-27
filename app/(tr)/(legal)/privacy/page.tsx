export const metadata = { title: 'Gizlilik Politikasi' }

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Gizlilik Politikasi</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Topladigimiz veriler</h2>
      <p>Hesap bilgileri (ad, e-posta), abonelik ve fatura kayitlari, uygulama
      kullanim kayitlari ve destek yazismalari. Odeme karti bilgileri tarafimizca
      saklanmaz; odeme islemleri Stripe uzerinden yurutulur.</p>
      <h2>Kullanim amaci</h2>
      <p>Hizmetin sunulmasi, abonelik yonetimi, guvenlik ve kotuye kullanimin
      onlenmesi, yasal yukumluluklerin yerine getirilmesi.</p>
      <h2>Ucuncu taraflar</h2>
      <p>Barindirma icin Vercel, veritabani ve kimlik dogrulama icin Supabase,
      odeme icin Stripe, e-posta icin Resend hizmetlerinden yararlanilmaktadir. Bot dogrulamasi icin
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
      <h2>Haklariniz</h2>
      <p>KVKK ve GDPR kapsaminda verilerinize erisme, duzeltme, silme ve isleme
      faaliyetine itiraz etme hakkina sahipsiniz. Talepleriniz icin iletisim
      sayfamizdaki adresleri kullanabilirsiniz.</p>
    </main>
  )
}
