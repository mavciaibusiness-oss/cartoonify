import type { Metadata } from 'next'
import NotFoundPage from '@/components/not-found-page'
import { getDictionary } from '@/lib/i18n'

export const metadata: Metadata = { title: getDictionary('en').meta.notFoundTitle }

export default function NotFound() {
  return <NotFoundPage locale="en" />
}
