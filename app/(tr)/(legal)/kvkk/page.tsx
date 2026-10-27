export const metadata = { title: 'KVKK Aydinlatma Metni' }

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
      <p>Hesap olusturma ve yonetimi, abonelik ve faturalama, destek taleplerinin
      karsilanmasi, guvenlik ve kotuye kullanimin onlenmesi, yasal
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
