import type { Metadata } from 'next'
import AccountPage from '@/components/account-page'
import { getDictionary, TITLE_SUFFIX } from '@/lib/i18n'

const t = getDictionary('en')

export const metadata: Metadata = {
  title: t.meta.accountTitle + TITLE_SUFFIX,
  robots: { index: false },
  alternates: { canonical: '/account', languages: { en: '/account', tr: '/tr/account', 'x-default': '/account' } },
}

export default function EnglishAccountPage() {
  return <AccountPage locale="en" />
}
