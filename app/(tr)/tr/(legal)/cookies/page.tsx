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
      <h1>Cerez Politikasi</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Cerez nedir</h2>
      <p>Cerezler, ziyaret ettiginiz siteler tarafindan cihaziniza kaydedilen
      kucuk metin dosyalaridir.</p>
      <h2>Kullandigimiz cerezler</h2>
      <p>Zorunlu cerezler: oturum yonetimi ve guvenlik icin gereklidir, devre
      disi birakilamaz. Analitik ve pazarlama cerezleri yalnizca acik rizaniz
      ile calistirilir.</p>
      <h2>Tarayici deposu</h2>
      <p>Ingilizce bir sayfada Turkce tarayici dili algilanirsa, Turkce surume gecis
      onerisi gosterilir. Oneriyi kapattiginizda bu tercih tarayicinin sessionStorage
      alanina, pth-lang-hint anahtariyla yalnizca o sekme oturumu icin yazilir. Bu bir
      cerez degildir, sunucuya gonderilmez ve sekme kapaninca silinir.</p>
      <h2>Yonetimi</h2>
      <p>Tarayici ayarlarinizdan cerezleri silebilir veya engelleyebilirsiniz.
      Zorunlu cerezlerin engellenmesi hizmetin calismasini etkileyebilir.</p>
      <h2>Ucuncu taraf cerezleri</h2>
      <p>Reklam veya analitik saglayicilar kendi cerezlerini kullanabilir. Bu
      cerezler yalnizca riza verildikten sonra yuklenir.</p>
    </main>
  )
}
