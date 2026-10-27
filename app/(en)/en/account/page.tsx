import type { Metadata } from 'next'
import AccountPage from '@/components/account-page'
import { getDictionary } from '@/lib/i18n'

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.accountTitle,
  robots: { index: false },
  alternates: { canonical: '/en/account', languages: { tr: '/account', en: '/en/account' } },
}

export default function EnglishAccountPage() {
  return <AccountPage locale="en" />
}
