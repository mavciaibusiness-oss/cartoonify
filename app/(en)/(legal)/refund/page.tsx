import type { Metadata } from 'next'
import Link from 'next/link'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Refund Policy' + TITLE_SUFFIX,
  alternates: { canonical: '/refund', languages: { en: '/refund', tr: '/tr/refund', 'x-default': '/refund' } },
  openGraph: { url: '/refund' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Refund Policy</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2 id="refund-rule">Refund rule</h2>
      <p>If you have not used any paid credit from a pack, you can ask for a full refund within 14 days of buying it.</p>
      <p>Once at least one paid credit from a pack has been used, that pack cannot be refunded.</p>
      <p>If a conversion fails because of a technical error, its credit goes back to your account automatically. You do not need to ask.</p>
      <p>Credits are digital content and are added to your account as soon as you pay, so the statutory right of withdrawal does not apply (EU Directive 2011/83/EU, Article 16(m)). The 14-day refund above is a separate promise we make to you.</p>
      <p>Polar is the merchant of record: it takes the payment, and refunds are made through Polar.</p>
      <h2 id="how-to-ask">How to ask</h2>
      <p>To ask for a refund, write to the e-mail address on the <Link href="/contact">contact page</Link> with the date of purchase and the e-mail address of your account. We review the request and reply. An approved refund goes back to your payment method through Polar, and the credits are taken off your account in proportion to the amount refunded.</p>
      <p>Credit packs are one-time purchases and there is no subscription. See the <Link href="/terms">Terms of Use</Link> for details.</p>
    </main>
  )
}
