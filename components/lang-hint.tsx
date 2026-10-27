'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { counterpartPath, getDictionary, localeOfPath } from '@/lib/i18n'

const KEY = 'pth-lang-hint'

/**
 * A one-line "switch to Turkish" bar for Turkish browsers on English pages.
 * Nothing on the server: it renders nothing until it has mounted. No redirect,
 * no cookie, no request. Closing it hides it for the browser tab's session.
 */
export default function LangHint() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (locale !== 'en') {
      setShown(false)
      return
    }
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || ''
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem(KEY) === 'dismissed'
    } catch {
      dismissed = false
    }
    setShown(first.toLowerCase().startsWith('tr') && !dismissed)
  }, [locale, pathname])

  if (!shown || locale !== 'en') return null
  const t = getDictionary('tr').langHint

  function close() {
    try {
      sessionStorage.setItem(KEY, 'dismissed')
    } catch {
      // storage unavailable: the bar still closes for this page view
    }
    setShown(false)
  }

  return (
    <div className="lang-hint" lang="tr">
      {t.text}{' '}
      <a className="lang-hint-link" href={counterpartPath(pathname)} hrefLang="tr">
        {t.link}
      </a>
      <button type="button" className="lang-hint-close" aria-label={t.close} onClick={close}>
        ×
      </button>
    </div>
  )
}
