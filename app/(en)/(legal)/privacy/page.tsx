import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Privacy Policy' + TITLE_SUFFIX,
  alternates: { canonical: '/privacy', languages: { en: '/privacy', tr: '/tr/privacy', 'x-default': '/privacy' } },
  openGraph: { url: '/privacy' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Privacy Policy</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>Data we collect</h2>
      <p>Account details (e-mail address), credit pack orders, usage records and support messages. We do not store payment card details; payments are handled by Polar, the merchant of record.</p>
      <h2>Why we use it</h2>
      <p>To provide the service, to sell credit packs, to keep the service safe and prevent abuse, and to meet legal duties.</p>
      <h2>Third parties</h2>
      <p>We use Vercel for hosting, Supabase for the database and sign-in, Polar for payments, Resend for e-mail and OpenAI to process the photo you upload. For bot checks we use Cloudflare Turnstile (IP address and browser signals), and for abuse counters we use Upstash (a keyed hash of the IP address, deleted within about an hour; the daily counter is kept for about 2 days). Some of these providers process data outside Turkey.</p>
      <h2 id="account-and-credits">Account and credits</h2>
      <p>You sign in with Google or with a link sent by e-mail, with no password. Google and Supabase are used for sign-in; your e-mail address and account ID are kept at Supabase. Sign-in e-mails are sent through Resend. Credit and conversion records are kept: date, tool, style and credit type. The image you upload is not part of these records and is not stored.</p>
      <h2 id="payments-and-credits">Payments and credits</h2>
      <p>Polar (polar.sh) takes the payment for credit packs as merchant of record. It handles your card and invoice details under its own privacy policy and issues the tax invoice itself. We never see or store your card number. We pass your account's e-mail address and account ID to Polar. On our side we keep the Polar order ID, the pack, the number of credits, the net amount, the currency and the refund amounts and dates.</p>
      <h2 id="free-allowance">Free allowance</h2>
      <p>To make sure the free allowance is given only once per e-mail address, we keep a SHA-256 hash of your address, not the address itself. This hash is kept even after you delete your account.</p>
      <p>Keyed hashes (HMAC-SHA-256) of your IP address and device are used for the daily limits on the free allowance for 2 days and are then deleted. The deletion runs automatically at the first free-allowance claim after that period.</p>
      <p>For the hourly conversion limit, a keyed hash of your IP address is kept at Upstash for about an hour (3700 seconds) at most.</p>
      <h2 id="delete-account">Deleting your account</h2>
      <p>You can delete your account at any time with the "Delete my account" button on the Profile page. It happens after a confirmation step and cannot be undone. Deleted: your profile, all remaining credits (paid ones included), your credit and conversion history and your welcome record. What stays: the hash of your e-mail address that stops the free allowance being given twice, and the Polar order and refund records that tax and accounting rules require, kept without a link to a person.</p>
      <h2>Your rights</h2>
      <p>Under KVKK and the GDPR you can ask to access, correct or delete your data and object to its processing. Use the details on the contact page to make a request. The KVKK notice is available in Turkish.</p>
    </main>
  )
}
