import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Çerez Politikası' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/cookies', languages: { en: '/cookies', tr: '/tr/cookies', 'x-default': '/cookies' } },
  openGraph: { url: '/tr/cookies' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Çerez Politikası</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Çerez nedir</h2>
      <p>Çerezler, ziyaret ettiğiniz siteler tarafından cihazınıza kaydedilen
      küçük metin dosyalarıdır.</p>
      <h2>Kullandığımız çerezler</h2>
      <p>Zorunlu çerezler: oturum yönetimi ve güvenlik için gereklidir, devre
      dışı bırakılamaz. Analitik ve pazarlama çerezleri yalnızca açık rızanız
      ile çalıştırılır.</p>
      <h2>Tarayıcı deposu</h2>
      <p>İngilizce bir sayfada Türkçe tarayıcı dili algılanırsa, Türkçe sürüme geçiş
      önerisi gösterilir. Öneriyi kapattığınızda bu tercih tarayıcının sessionStorage
      alanına, pth-lang-hint anahtarıyla yalnızca o sekme oturumu için yazılır. Bu bir
      çerez değildir, sunucuya gönderilmez ve sekme kapanınca silinir.</p>
      <h2>Yönetimi</h2>
      <p>Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz.
      Zorunlu çerezlerin engellenmesi hizmetin çalışmasını etkileyebilir.</p>
      <h2>Üçüncü taraf çerezleri</h2>
      <p>Reklam veya analitik sağlayıcılar kendi çerezlerini kullanabilir. Bu
      çerezler yalnızca rıza verildikten sonra yüklenir.</p>
    </main>
  )
}
