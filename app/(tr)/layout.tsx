import type { Metadata, Viewport } from 'next'
import '../globals.css'
import SiteShell from '@/components/site-shell'
import { getDictionary } from '@/lib/i18n'

const SITE_URL = 'https://cartoonify.vercel.app'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.siteTitle,
  description: t.meta.siteDescription,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
    locale: 'tr_TR',
    type: 'website',
    url: SITE_URL,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// One of two root layouts (task 0010 section 3.4): this one is Turkish.
export default function TurkishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
