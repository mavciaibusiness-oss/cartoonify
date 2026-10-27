import type { Metadata } from 'next'
import AccountPage from '@/components/account-page'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.accountTitle,
  robots: { index: false },
  alternates: { canonical: '/account', languages: { tr: '/account', en: '/en/account' } },
}

export default function TurkishAccountPage() {
  return <AccountPage locale="tr" />
}
