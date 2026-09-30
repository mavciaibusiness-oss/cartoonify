import type { Metadata, Viewport } from 'next'
import '../globals.css'
import SiteShell from '@/components/site-shell'
import { siteUrl } from '@/lib/env'
import { getDictionary } from '@/lib/i18n'

const SITE_URL = siteUrl()

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.siteTitle,
  description: t.meta.siteDescription,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
    locale: 'en_US',
    type: 'website',
    url: SITE_URL + '/en',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// One of two root layouts (task 0010 section 3.4): this one is English.
export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
