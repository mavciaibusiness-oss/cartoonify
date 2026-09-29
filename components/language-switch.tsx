'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { counterpartPath, getDictionary, LOCALE_LABELS, localeOfPath } from '@/lib/i18n'

/**
 * TR | EN, in the header. The language comes from the path. Turkish and English
 * have separate root layouts, app/(tr)/layout.tsx and app/(en)/layout.tsx, so
 * each page's <html lang> is right (task 0010 §3.4). The cost: switching
 * language crosses root layouts, which is a full page load, and a chosen
 * photograph does not survive it. Within one language, a client transition
 * still keeps it (components/upload-state.tsx).
 */
export default function LanguageSwitch() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const t = getDictionary(locale)
  const other = counterpartPath(pathname)
  const trHref = locale === 'tr' ? pathname : other
  const enHref = locale === 'en' ? pathname : other

  return (
    <nav className="lang-switch" aria-label={t.header.languageLabel} lang={locale}>
      <Link href={trHref} hrefLang="tr" lang="tr" aria-current={locale === 'tr' ? 'page' : undefined}>
        {LOCALE_LABELS.tr}
      </Link>
      <span className="lang-switch-sep" aria-hidden="true">
        |
      </span>
      <Link href={enHref} hrefLang="en" lang="en" aria-current={locale === 'en' ? 'page' : undefined}>
        {LOCALE_LABELS.en}
      </Link>
    </nav>
  )
}
