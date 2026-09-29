import type { Metadata } from 'next'
import Workshop from '@/components/workshop'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.workshopTitle,
  description: t.meta.workshopDescription,
  alternates: {
    canonical: '/workshop',
    languages: { tr: '/workshop', en: '/en/workshop' },
  },
}

export default function WorkshopPage() {
  return <Workshop locale="tr" />
}
