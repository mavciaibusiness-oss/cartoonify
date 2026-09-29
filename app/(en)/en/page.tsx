import type { Metadata } from 'next'
import Landing from '@/components/landing'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  alternates: {
    canonical: '/en',
    languages: { tr: '/', en: '/en' },
  },
  openGraph: {
    title: t.meta.homeTitle,
    description: t.meta.homeDescription,
    locale: 'en_US',
    type: 'website',
    url: '/en',
  },
}

export default function EnglishHome() {
  return <Landing locale="en" />
}
