'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getDictionary, localeOfPath, localizedPath } from '@/lib/i18n'

/**
 * The Profile link in the header. The built HTML never contains it: on mount
 * it asks GET /api/session once and renders only when the answer is true, so
 * the static header keeps exactly its four links.
 */
export default function ProfileLink() {
  const pathname = usePathname() ?? '/'
  const locale = localeOfPath(pathname)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function ask() {
      try {
        const response = await fetch('/api/session', { cache: 'no-store' })
        const data = (await response.json()) as { signedIn?: boolean }
        if (!cancelled) setSignedIn(data.signedIn === true)
      } catch {
        if (!cancelled) setSignedIn(false)
      }
    }
    void ask()
    return () => {
      cancelled = true
    }
  }, [])

  if (!signedIn) return null
  const href = localizedPath(locale, '/account')
  return (
    <Link className="site-nav-profile" href={href} aria-current={pathname === href ? 'page' : undefined}>
      {getDictionary(locale).header.profile}
    </Link>
  )
}
