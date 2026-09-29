'use client'

import Link from 'next/link'
import { getDictionary, localizedPath, type Locale } from '@/lib/i18n'
import CartoonifyForm from './cartoonify-form'
import KvkkNotice from './kvkk-notice'
import UploadControl from './upload-control'
import { useUpload } from './upload-state'

/**
 * The workshop body, shared by /workshop and /en/workshop. With no photograph
 * chosen it shows the upload control, with the disclosure above it; with one
 * chosen it shows the workbench.
 */
export default function Workshop({ locale }: { locale: Locale }) {
  const { previewUrl } = useUpload()
  const t = getDictionary(locale)

  if (!previewUrl) {
    return (
      <main className="workshop-page">
        <section className="workshop-empty">
          <p className="workshop-badge">{t.workshop.badge}</p>
          <h1>{t.workshop.emptyTitle}</h1>
          <p className="workshop-empty-lede">{t.workshop.emptyLede}</p>

          <KvkkNotice locale={locale} />

          <UploadControl locale={locale} redirectOnSelect={false} />

          <p className="workshop-empty-note">
            {t.workshop.backPrompt} <Link href={localizedPath(locale, '/')}>{t.workshop.backLink}</Link>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="workshop-page">
      <CartoonifyForm locale={locale} />
    </main>
  )
}
