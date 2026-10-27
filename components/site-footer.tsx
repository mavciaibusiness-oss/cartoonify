'use client'

import { usePathname } from 'next/navigation'
import { getDictionary, localeOfPath, localizedPath } from '@/lib/i18n'

/**
 * Legal links in the path's language. The KVKK notice exists only in Turkish,
 * so both languages link to /tr/kvkk and the English label says so.
 */
export default function SiteFooter() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const t = getDictionary(locale).footer

  return (
    <footer lang={locale} aria-label={t.label}>
      <a href={localizedPath(locale, '/privacy')}>{t.privacy}</a>
      {' | '}
      <a href={localizedPath(locale, '/terms')}>{t.terms}</a>
      {' | '}
      <a href={localizedPath(locale, '/refund')}>{t.refund}</a>
      {' | '}
      <a href="/tr/kvkk">{t.kvkk}</a>
      {' | '}
      <a href={localizedPath(locale, '/cookies')}>{t.cookies}</a>
      {' | '}
      <a href={localizedPath(locale, '/contact')}>{t.contact}</a>
    </footer>
  )
}
