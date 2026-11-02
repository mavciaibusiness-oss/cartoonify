'use client'

import dynamic from 'next/dynamic'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getDictionary, localeOfPath } from '@/lib/i18n'
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

// The banner markup is a separate, lazily loaded chunk (task 0036).
const Banner = dynamic(() => import('./consent-banner'), { ssr: false })

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
    // First visit: show the banner 0.5 s after the load event, when the browser is idle (3 s at the latest).
    let timer = 0
    let idle = 0
    let cancelled = false
    function schedule() {
      timer = window.setTimeout(() => {
        const show = () => {
          if (!cancelled) setOpen(true)
        }
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(show, { timeout: 2000 })
        else idle = window.setTimeout(show, 1500)
      }, 500)
    }
    if (stored === null) {
      if (document.readyState === 'complete') schedule()
      else window.addEventListener('load', schedule, { once: true })
    }
    function reopen() {
      setOpen(true)
    }
    window.addEventListener(REOPEN_EVENT, reopen)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (idle && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle)
      window.removeEventListener('load', schedule)
      window.removeEventListener(REOPEN_EVENT, reopen)
    }
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
      {open ? <Banner locale={locale} t={t} onAccept={() => choose('granted')} onReject={() => choose('denied')} /> : null}
    </>
  )
}
