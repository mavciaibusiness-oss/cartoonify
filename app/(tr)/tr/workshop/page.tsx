import type { Metadata } from 'next'
import Workshop from '@/components/workshop'
import { turnstileSiteKey } from '@/lib/env'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.workshopTitle,
  description: t.meta.workshopDescription,
  alternates: {
    canonical: '/tr/workshop',
    languages: { en: '/workshop', tr: '/tr/workshop', 'x-default': '/workshop' },
  },
  openGraph: {
    title: t.meta.workshopTitle,
    description: t.meta.workshopDescription,
    locale: 'tr_TR',
    type: 'website',
    url: '/tr/workshop',
  },
}

export default function WorkshopPage() {
  return <Workshop locale="tr" turnstileSiteKey={turnstileSiteKey()} />
}
