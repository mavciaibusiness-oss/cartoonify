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
      <h2>Measurement and advertising cookies</h2>
      <p>With your consent we use Google Analytics (visit statistics), Google Ads (measuring how well our ads work) and Meta (the Meta pixel, measuring how well our Meta ads work). They load only after you press Accept in the banner. Before that, and after you press Reject, none of them is loaded and nothing is sent to them. These are the cookies they set:</p>
      <ul>
        <li><code>_ga</code> and <code>_ga_&lt;id&gt;</code> - Google Analytics - tells visits and visitors apart - 2 years.</li>
        <li><code>_gcl_au</code> - Google Ads - links an ad click to a later sign-up or purchase - 90 days.</li>
        <li><code>_fbp</code> - Meta - tells visits apart for Meta ads measurement - 90 days.</li>
      </ul>
      <p>Events sent to these tools: a new account was created, a credit pack checkout was started, and a payment was completed (with the amount, the currency and an order id so that a payment is not counted twice). No name, e-mail address or phone number is sent.</p>
      <h2>Browser storage</h2>
      <p>If the site sees that your browser's first language is Turkish while you read an English page, it suggests switching to the Turkish version. When you close that suggestion, the choice is written to the browser's sessionStorage under the key pth-lang-hint, for that tab's session only. It is not a cookie, it is never sent to our server, and it disappears when the tab is closed.</p>
      <p>Our own record of your choice is kept in your browser's localStorage, not in a cookie:</p>
      <ul>
        <li><code>pth-consent</code> - your choice, granted or denied.</li>
        <li><code>pth-consent-at</code> - the time you made it. The choice is valid for 12 months; after that the banner asks again and nothing loads until you choose.</li>
        <li><code>pth-tracked</code> - set only with consent: the last checkout ids already counted, so the same payment is not counted twice.</li>
      </ul>
      <h2>Managing cookies</h2>
      <p>You can change your choice at any time with the Cookie settings button at the bottom of every page. Pressing Reject there stops the tools from the next page on; tools already loaded in the page you have open cannot be unloaded and stop when you go to the next page.</p>
      <p>You can delete or block cookies in your browser settings. Blocking the necessary cookies may stop the service from working.</p>
      <h2>Third-party cookies</h2>
      <p>Advertising or analytics providers may set their own cookies. Such cookies are loaded only after you give consent.</p>
    </main>
  )
}
