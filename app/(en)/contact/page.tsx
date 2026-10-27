import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Contact' + TITLE_SUFFIX,
  alternates: { canonical: '/contact', languages: { en: '/contact', tr: '/tr/contact', 'x-default': '/contact' } },
  openGraph: { url: '/contact' },
}

export default function Contact() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Contact</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Company details</h2>
      <p>Legal name: DRAFT — NOT A REGISTERED ENTITY — REVIEW REQUIRED</p>
      <p>Address: DRAFT — REVIEW REQUIRED</p>
      <p>E-mail: mavcimavci1983@gmail.com</p>
      <p>MERSIS: DRAFT — NO MERSIS — REVIEW REQUIRED</p>
      <p>KEP: DRAFT — NO KEP — REVIEW REQUIRED</p>
      <h2>Support</h2>
      <p>For support requests, write to the e-mail address above. We reply within two business days. For requests under KVKK, use the methods described in the KVKK notice, which is available in Turkish.</p>
    </main>
  )
}
