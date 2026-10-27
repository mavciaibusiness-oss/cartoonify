'use client'

import { getDictionary, type Locale } from '@/lib/i18n'

/** The remaining credits, always visible to a signed-in visitor, with the way out. */
export default function CreditBadge({
  locale,
  free,
  paid,
  onSignOut,
}: {
  locale: Locale
  free: number
  paid: number
  onSignOut: () => void
}) {
  const t = getDictionary(locale)
  return (
    <div className="credit-badge" data-free={free} data-paid={paid} role="status">
      <span className="credit-badge-label">{t.account.creditsLabel}:</span>{' '}
      <span className="credit-badge-count">
        <strong>{free}</strong> {t.account.freeCredits}
      </span>
      {' · '}
      <span className="credit-badge-count">
        <strong>{paid}</strong> {t.account.paidCredits}
      </span>
      <button type="button" className="account-sign-out ghost-button" onClick={onSignOut}>
        {t.account.signOut}
      </button>
    </div>
  )
}
