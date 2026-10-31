import type { Metadata } from 'next'
import Link from 'next/link'
import { TITLE_SUFFIX } from '@/lib/i18n'
import { LEGAL_ENTITY } from '@/lib/legal-entity'

export const metadata: Metadata = {
  title: 'Terms of Use' + TITLE_SUFFIX,
  alternates: { canonical: '/terms', languages: { en: '/terms', tr: '/tr/terms', 'x-default': '/terms' } },
  openGraph: { url: '/terms' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Terms of Use</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Scope of the service</h2>
      <p>These terms set the conditions for using ProToolHub Cartoon, a service that turns your photo into a cartoon with AI. By using the service you accept these terms.</p>
      <h2>Account and responsibility</h2>
      <p>You are responsible for the security of your account. If you share your sign-in details with others, you are responsible for any harm that follows.</p>
      <h2 id="credit-packs">Credit packs</h2>
      <p>Credits are sold as one-time packs. There is no subscription and nothing renews automatically. Three packs are sold: 10 credits for $3.99, 30 credits for $9.99 and 75 credits for $19.99. Credits do not expire. Conversions made with paid credits carry no ProToolHub mark (watermark), and paid credits are spent before free ones.</p>
      <p>Stripe processes the payment and the seller is AVC TRADE LLC. Tax is calculated by Stripe Tax at checkout and is included in the price. Refunds are made through Stripe. When a refund is made, credits are taken back in proportion to the amount refunded, rounded up. If the credits have been spent, only the part that can still be taken back is deducted, and your balance never goes below zero. If a payment is disputed with the card issuer (a chargeback), the credits of that pack are taken back. Seller address: {LEGAL_ENTITY.address}. For the refund conditions, see the <Link href="/refund">Refund Policy</Link>.</p>
      <h2 id="icerik-kurallari">Content rules</h2>
      <p>The photo you upload is sent to OpenAI (openai.com) to be processed and is not stored by us. By uploading a photo you agree to these rules: images with nudity or violence cannot be uploaded; a parent's permission is required for photos of children under 18; copyrighted images and images of celebrities cannot be uploaded; the service cannot be used to humiliate others. You must confirm that you have the right to use the photo and, if other people appear in it, that you have their permission. Images that break these rules are not converted.</p>
      <h2>Termination</h2>
      <p>If these terms are broken, an account may be suspended or closed. You can close your account at any time from the Profile page.</p>
      <h2>Governing law</h2>
      <p>The laws of the Republic of Turkey apply to this agreement.</p>
    </main>
  )
}
