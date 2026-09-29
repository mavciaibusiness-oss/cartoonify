'use client'

import { usePathname } from 'next/navigation'
import { getDictionary, localeOfPath } from '@/lib/i18n'

/**
 * Legal links in the path's language. The pages themselves exist only in
 * Turkish, and the English labels say so.
 */
export default function SiteFooter() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const t = getDictionary(locale).footer

  return (
    <footer lang={locale} aria-label={t.label}>
      <a href="/privacy">{t.privacy}</a>
      {' | '}
      <a href="/terms">{t.terms}</a>
      {' | '}
      <a href="/kvkk">{t.kvkk}</a>
      {' | '}
      <a href="/cookies">{t.cookies}</a>
      {' | '}
      <a href="/contact">{t.contact}</a>
    </footer>
  )
}
