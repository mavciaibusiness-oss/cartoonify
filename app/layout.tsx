import type { Metadata, Viewport } from 'next'
import './globals.css'
import LanguageSwitch from '@/components/language-switch'
import SiteFooter from '@/components/site-footer'
import { UploadProvider } from '@/components/upload-state'
import { getDictionary } from '@/lib/i18n'

const SITE_URL = 'https://cartoonify.vercel.app'

// Turkish is the default at the root. The English pages override the title,
// the description and the Open Graph locale in their own metadata.
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="site-header">
          <LanguageSwitch />
        </header>
        <UploadProvider>{children}</UploadProvider>
        <SiteFooter />
      </body>
    </html>
  )
}
