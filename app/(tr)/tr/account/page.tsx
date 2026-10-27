import type { Metadata } from 'next'
import AccountPage from '@/components/account-page'
import { getDictionary, TITLE_SUFFIX } from '@/lib/i18n'

const t = getDictionary('tr')

export const metadata: Metadata = {
  title: t.meta.accountTitle + TITLE_SUFFIX,
  robots: { index: false },
  alternates: { canonical: '/tr/account', languages: { en: '/account', tr: '/tr/account', 'x-default': '/account' } },
}

export default function TurkishAccountPage() {
  return <AccountPage locale="tr" />
}
