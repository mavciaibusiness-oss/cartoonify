import type { Metadata } from 'next'
import Workshop from '@/components/workshop'
import { turnstileSiteKey } from '@/lib/env'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.workshopTitle,
  description: t.meta.workshopDescription,
  alternates: {
    canonical: '/workshop',
    languages: { en: '/workshop', tr: '/tr/workshop', 'x-default': '/workshop' },
  },
  openGraph: {
    title: t.meta.workshopTitle,
    description: t.meta.workshopDescription,
    locale: 'en_US',
    type: 'website',
    url: '/workshop',
  },
}

export default function EnglishWorkshopPage() {
  return <Workshop locale="en" turnstileSiteKey={turnstileSiteKey()} />
}
