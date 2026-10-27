import type { Metadata } from 'next'
import { TITLE_SUFFIX } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Cookie Policy' + TITLE_SUFFIX,
  alternates: { canonical: '/cookies', languages: { en: '/cookies', tr: '/tr/cookies', 'x-default': '/cookies' } },
  openGraph: { url: '/cookies' },
}

export default function Page() {
  return (
    <main className="prose mx-auto p-8">
      <h1>Cookie Policy</h1>
      {/* REVIEW REQUIRED - draft text. A lawyer must review this before launch.
          Only the operator removes this marker, and only after that review: deleting it
          asserts a review that did not happen. It is a warning while you build and a
          blocker before you ship. */}
      <h2>What a cookie is</h2>
      <p>Cookies are small text files that the sites you visit save on your device.</p>
      <h2>The cookies we use</h2>
      <p>Strictly necessary cookies are needed for sign-in and security and cannot be turned off. Analytics and marketing cookies run only with your clear consent.</p>
      <h2>Browser storage</h2>
      <p>If the site sees that your browser's first language is Turkish while you read an English page, it suggests switching to the Turkish version. When you close that suggestion, the choice is written to the browser's sessionStorage under the key pth-lang-hint, for that tab's session only. It is not a cookie, it is never sent to our server, and it disappears when the tab is closed.</p>
      <h2>Managing cookies</h2>
      <p>You can delete or block cookies in your browser settings. Blocking the necessary cookies may stop the service from working.</p>
      <h2>Third-party cookies</h2>
      <p>Advertising or analytics providers may set their own cookies. Such cookies are loaded only after you give consent.</p>
    </main>
  )
}
