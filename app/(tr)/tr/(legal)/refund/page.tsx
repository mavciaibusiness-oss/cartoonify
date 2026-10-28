import type { Metadata } from 'next'
import Link from 'next/link'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'İade Politikası' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/refund', languages: { en: '/refund', tr: '/tr/refund', 'x-default': '/refund' } },
  openGraph: { url: '/tr/refund' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>İade Politikası</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2 id="iade-kurali">İade kuralı</h2>
      <p>Satın aldığınız paketten hiç ücretli kredi kullanmadıysanız, satın alma tarihinden itibaren 14 gün içinde tam iade isteyebilirsiniz.</p>
      <p>Paketten en az bir ücretli kredi kullanıldıysa o paket için iade yapılmaz.</p>
      <p>Teknik bir hata nedeniyle tamamlanamayan dönüşümün kredisi hesabınıza otomatik olarak geri yüklenir; bunun için başvurmanız gerekmez.</p>
      <p>Krediler dijital içeriktir ve ödeme yapıldığı anda hesabınıza tanımlanır. Bu nedenle Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı bulunmaz; yukarıdaki 14 günlük iade, size ayrıca tanıdığımız bir haktır.</p>
      <p>Satıcı AVC TRADE LLC olup ödemeler Stripe aracılığıyla alınır; iadeler de Stripe üzerinden, ödemenin yapıldığı karta yapılır.</p>
      <h2 id="nasil-basvurulur">Nasıl başvurulur</h2>
      <p>İade istemek için <Link href="/tr/contact">iletişim sayfasındaki</Link> e-posta adresine, satın alma tarihini ve hesabınızın e-posta adresini yazarak ulaşın. Başvurunuzu inceleyip yanıtlarız; onaylanan iade Stripe üzerinden ödeme yönteminize yapılır ve iade edilen tutarla orantılı olarak kredileriniz hesabınızdan düşülür.</p>
      <p>Kredi paketleri tek seferliktir; abonelik yoktur. Ayrıntılar için <Link href="/tr/terms">Kullanım Şartları</Link> sayfasına bakın.</p>
    </main>
  )
}
