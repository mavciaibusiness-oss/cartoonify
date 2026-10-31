'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getDictionary, localeOfPath, localizedPath } from '@/lib/i18n'
import {
  REOPEN_EVENT,
  readChoice,
  startTags,
  stopTags,
  tagScripts,
  writeChoice,
  type Choice,
  type MeasurementIds,
} from '@/lib/analytics'

/**
 * The cookie banner and the measurement libraries behind it (task 0032).
 * The ids come from the server layout as props. Until the visitor accepts, and
 * after a rejection, no library is in the page. A choice holds for 12 months.
 */
export default function Consent({ ids }: { ids: MeasurementIds }) {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const t = getDictionary(locale).consent
  // 'unknown' until the browser's storage has been read, so the server and first client render agree.
  const [choice, setChoice] = useState<Choice | 'none' | 'unknown'>('unknown')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = readChoice()
    if (stored === 'granted') startTags(ids)
    setChoice(stored ?? 'none')
    setOpen(stored === null)
    function reopen() {
      setOpen(true)
    }
    window.addEventListener(REOPEN_EVENT, reopen)
    return () => window.removeEventListener(REOPEN_EVENT, reopen)
  }, [ids])

  function choose(next: Choice) {
    writeChoice(next)
    if (next === 'granted') startTags(ids)
    else stopTags()
    setChoice(next)
    setOpen(false)
  }

  return (
    <>
      {choice === 'granted'
        ? tagScripts(ids).map((s) => <Script key={s.id} id={s.id} src={s.src} strategy="afterInteractive" />)
        : null}
      {open ? (
        <section className="consent-banner" aria-label={t.label} lang={locale}>
          <p>
            {t.text} <a href={localizedPath(locale, '/cookies')}>{t.link}</a>
          </p>
          <div className="consent-actions">
            <button type="button" className="consent-accept" onClick={() => choose('granted')}>
              {t.accept}
            </button>
            <button type="button" className="consent-reject" onClick={() => choose('denied')}>
              {t.reject}
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
