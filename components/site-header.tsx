'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDictionary, localeOfPath, localizedPath } from '@/lib/i18n'
import LanguageSwitch from './language-switch'

/**
 * The coloured band on every page: brand, menu, the place for a future sign-in,
 * then TR | EN. The language and the current page come from the path. The band
 * is a full-width wrapper so .site-header keeps its own width limit.
 */
export default function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const t = getDictionary(locale).header
  const home = localizedPath(locale, '/')
  const workshop = localizedPath(locale, '/workshop')
  const isHome = pathname === '/' || pathname === '/en'

  return (
    <div className="site-strip">
      <header className="site-header">
        <Link className="site-brand" href={home}>
          <img src="/brand/protoolhub-icon.svg" alt="" width={32} height={32} />
          <span>{t.brand}</span>
        </Link>
        <nav className="site-nav" aria-label={t.navLabel}>
          <Link href={home} aria-current={isHome ? 'page' : undefined}>
            {t.home}
          </Link>
          <Link href={workshop} aria-current={pathname === workshop ? 'page' : undefined}>
            {t.workshop}
          </Link>
          <Link href={home + '#styles'}>{t.styles}</Link>
          <Link href="/contact" aria-current={pathname === '/contact' ? 'page' : undefined}>
            {t.contact}
          </Link>
        </nav>
        <div className="site-header-end">
          <LanguageSwitch />
        </div>
      </header>
    </div>
  )
}
