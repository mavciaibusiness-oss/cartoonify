import Link from 'next/link'
import { getDictionary, type Locale } from '@/lib/i18n'

/**
 * The cross-border transfer disclosure. The only place it is rendered, and it
 * goes above every file input on every page: a disclosure shown after the
 * control it describes has been used is not a disclosure.
 *
 * The Turkish wording is restored verbatim from f70fb94; the English is a
 * translation of it. No 'use client': it renders in the server landing page
 * and inside the client workshop alike.
 */
export default function KvkkNotice({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).kvkk
  return (
    <p className="kvkk-notice">
      {t.lead}
      <strong>{t.processor}</strong>
      {t.afterProcessor}
      <strong>{t.country}</strong>
      {t.afterCountry}
      <strong>{t.transfer}</strong>
      {t.afterTransfer}
      <Link href="/kvkk">{t.link}</Link>
      {t.afterLink}
    </p>
  )
}
