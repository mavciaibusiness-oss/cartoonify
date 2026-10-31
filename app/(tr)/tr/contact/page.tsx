import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'
import { LEGAL_ENTITY } from '@/lib/legal-entity'

export const metadata: Metadata = {
  title: 'İletişim' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/contact', languages: { en: '/contact', tr: '/tr/contact', 'x-default': '/contact' } },
  openGraph: { url: '/tr/contact' },
}

export default function Contact() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Iletisim</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Sirket bilgileri</h2>
      <p>Unvan: {LEGAL_ENTITY.name}</p>
      <p>Adres: {LEGAL_ENTITY.address}</p>
      <p>E-posta: mavcimavci1983@gmail.com</p>
      <h2>Destek</h2>
      <p>Destek talepleriniz icin yukaridaki e-posta adresini kullanabilirsiniz.
      Talepler mesai gunlerinde en gec iki is gunu icinde yanitlanir. KVKK
      kapsamindaki basvurular icin KVKK sayfamizda belirtilen yontemleri
      kullaniniz.</p>
    </main>
  )
}
