import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = 'https://cartoonify.vercel.app'

const TITLE = 'Cartoonify — Fotoğrafını Karikatüre Çevir'
const DESCRIPTION =
  'Cartoonify ile fotoğrafınızı saniyeler içinde renkli, çizgi film tarzında bir karikatüre dönüştürün. Kayıt gerektirmez, ücretsizdir.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
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
        {children}
        <footer>
          <a href="/privacy">Gizlilik</a>{' | '}
          <a href="/terms">Kullanim Sartlari</a>{' | '}
          <a href="/kvkk">KVKK</a>{' | '}
          <a href="/cookies">Cerezler</a>{' | '}
          <a href="/contact">Iletisim</a>
        </footer>
      </body>
    </html>
  )
}
