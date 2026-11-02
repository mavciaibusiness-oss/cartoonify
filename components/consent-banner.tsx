'use client'

import type { Locale } from '@/lib/i18n'
import { localizedPath } from '@/lib/i18n'

type Texts = { label: string; text: string; link: string; accept: string; reject: string }

/**
 * The cookie banner markup (task 0036). Loaded lazily by components/consent.tsx,
 * only when it is about to show, so none of it is in the scripts loaded before
 * the page's load event.
 */
export default function ConsentBanner({
  locale,
  t,
  onAccept,
  onReject,
}: {
  locale: Locale
  t: Texts
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <section className="consent-banner" aria-label={t.label} lang={locale}>
      <p>
        {t.text} <a href={localizedPath(locale, '/cookies')}>{t.link}</a>
      </p>
      <div className="consent-actions">
        <button type="button" className="consent-accept" onClick={onAccept}>
          {t.accept}
        </button>
        <button type="button" className="consent-reject" onClick={onReject}>
          {t.reject}
        </button>
      </div>
    </section>
  )
}
