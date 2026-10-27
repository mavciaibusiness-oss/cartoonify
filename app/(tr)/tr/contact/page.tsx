import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'İletişim' + TITLE_SUFFIX,
  alternates: { canonical: '/tr/contact', languages: { en: '/contact', tr: '/tr/contact', 'x-default': '/contact' } },
  openGraph: { url: '/tr/contact' },
}

export default function Contact() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Iletisim</h1>
      <h2>Sirket bilgileri</h2>
      <p>Unvan: DRAFT — NOT A REGISTERED ENTITY — REVIEW REQUIRED</p>
      <p>Adres: DRAFT — REVIEW REQUIRED</p>
      <p>E-posta: mavcimavci1983@gmail.com</p>
      <p>MERSIS: DRAFT — NO MERSIS — REVIEW REQUIRED</p>
      <p>KEP: DRAFT — NO KEP — REVIEW REQUIRED</p>
      <h2>Destek</h2>
      <p>Destek talepleriniz icin yukaridaki e-posta adresini kullanabilirsiniz.
      Talepler mesai gunlerinde en gec iki is gunu icinde yanitlanir. KVKK
      kapsamindaki basvurular icin KVKK sayfamizda belirtilen yontemleri
      kullaniniz.</p>
    </main>
  )
}
