export const metadata = {
  title: 'Cartoonify',
  description: 'Cartoonify',
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
