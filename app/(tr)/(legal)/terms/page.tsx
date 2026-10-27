export const metadata = { title: 'Kullanim Sartlari' }

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Kullanim Sartlari</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Hizmetin kapsami</h2>
      <p>Bu sozlesme, Cartoonify hizmetinin kullanimina iliskin sartlari
      duzenler. Hizmeti kullanarak bu sartlari kabul etmis sayilirsiniz.</p>
      <h2>Hesap ve sorumluluk</h2>
      <p>Hesap guvenliginden kullanici sorumludur. Hesap bilgilerinin ucuncu
      kisilerle paylasilmasi durumunda dogacak zararlardan kullanici sorumludur.</p>
      <h2>Abonelik ve odeme</h2>
      <p>Abonelikler donemsel olarak yenilenir. Iptal, mevcut donem sonunda
      gecerli olur. Cayma hakki ve iade kosullari yurulukteki mevzuata tabidir.</p>
      <h2 id="icerik-kurallari">İçerik kuralları</h2>
      <p>Yüklediğiniz fotoğraf, işlenmek üzere OpenAI (openai.com)
      hizmetine gönderilir ve tarafımızca saklanmaz. Fotoğraf yüklerken şu kurallara
      uymayı kabul edersiniz: çıplaklık ve şiddet içeren görseller yüklenemez; 18 yaşın
      altındaki çocukların fotoğrafları için ebeveyn izni gerekir; telifli ya da ünlülere
      ait görseller yüklenemez; başkalarını küçük düşürme amacıyla kullanılamaz.
      Fotoğrafı kullanma hakkınızın olduğunu ve fotoğrafta başkası varsa onun iznini
      aldığınızı onaylamanız gerekir. Bu kurallara uymayan görseller dönüştürülmez.</p>
      <h2 id="kredi-paketleri">Kredi paketleri</h2>
      <p>Üç kredi paketi satılır: 10 kredi $3.99, 30 kredi $9.99 ve 75 kredi $19.99.
      Ödeme tek seferliktir; abonelik yoktur ve kendiliğinden yenilenen bir ödeme alınmaz.
      Kredilerin süresi dolmaz. Ücretli kredilerle yapılan dönüşümlerde ProToolHub
      işareti (filigran) bulunmaz; ücretli krediler ücretsiz kredilerden önce harcanır.</p>
      <p>Ödemeyi Polar alır; Polar satıcı kaydıdır (Merchant of Record) ve vergi ile
      faturayı düzenler. İadeler Polar üzerinden yapılır. Bir iade yapıldığında, iade
      edilen tutarla orantılı olarak krediler geri alınır (orantılı, yukarı yuvarlanarak).
      Krediler harcanmışsa geri alınabilen kısım kadarı düşülür; bakiye sıfırın altına
      inmez.</p>
      <h2>Fesih</h2>
      <p>Sartlarin ihlali halinde hesap askiya alinabilir veya kapatilabilir.
      Kullanici diledigi zaman hesabini kapatabilir.</p>
      <h2>Uygulanacak hukuk</h2>
      <p>Bu sozlesmeye Turkiye Cumhuriyeti hukuku uygulanir.</p>
    </main>
  )
}
