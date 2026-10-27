import type { Metadata } from 'next'
import Landing from '@/components/landing'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  alternates: {
    canonical: '/tr',
    languages: { en: '/', tr: '/tr', 'x-default': '/' },
  },
  openGraph: {
    title: t.meta.homeTitle,
    description: t.meta.homeDescription,
    locale: 'tr_TR',
    type: 'website',
    url: '/tr',
  },
}

export default function Home() {
  return <Landing locale="tr" />
}
