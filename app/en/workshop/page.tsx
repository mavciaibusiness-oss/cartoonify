import type { Metadata } from 'next'
import Workshop from '@/components/workshop'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.workshopTitle,
  description: t.meta.workshopDescription,
  alternates: {
    canonical: '/en/workshop',
    languages: { tr: '/workshop', en: '/en/workshop' },
  },
  openGraph: {
    title: t.meta.workshopTitle,
    description: t.meta.workshopDescription,
    locale: 'en_US',
    type: 'website',
    url: '/en/workshop',
  },
}

export default function EnglishWorkshopPage() {
  return <Workshop locale="en" />
}
