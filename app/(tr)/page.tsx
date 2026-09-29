import type { Metadata } from 'next'
import Landing from '@/components/landing'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.homeTitle,
  description: t.meta.homeDescription,
  alternates: {
    canonical: '/',
    languages: { tr: '/', en: '/en' },
  },
}

export default function Home() {
  return <Landing locale="tr" />
}
