'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getDictionary, localizedPath, type Locale } from '@/lib/i18n'
import AccountPanel from './account-panel'
import CartoonifyForm from './cartoonify-form'
import CreditBadge from './credit-badge'
import CreditPacks from './credit-packs'
import CreditPurchaseStatus from './credit-purchase-status'
import KvkkNotice from './kvkk-notice'
import UploadControl from './upload-control'
import { useUpload } from './upload-state'

type Balance = { free: number; paid: number }

type Account =
  | { kind: 'pending' }
  | { kind: 'open' }
  | { kind: 'signedOut' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; balance: Balance; welcome: string }

type WalletAnswer = {
  ok?: boolean
  code?: string
  free?: number
  paid?: number
  welcome?: string
  unconfigured?: boolean
  production?: boolean
}

/**
 * The workshop body, shared by /workshop and /en/workshop. It asks the server
 * for the wallet first. While that is pending, and when accounts are not
 * configured outside production, it is exactly the workshop it always was.
 * Signed out it shows the sign-in panel instead of the upload control; signed
 * in it shows the credit badge above the upload control or the workbench.
 */
export default function Workshop({ locale, turnstileSiteKey }: { locale: Locale; turnstileSiteKey: string }) {
  const { previewUrl } = useUpload()
  const t = getDictionary(locale)
  const [account, setAccount] = useState<Account>({ kind: 'pending' })
  const [authFailed, setAuthFailed] = useState(false)
  const [packsOpen, setPacksOpen] = useState(false)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setAuthFailed(new URLSearchParams(window.location.search).get('auth') === 'failed')
    async function open() {
      try {
        const response = await fetch('/api/wallet', { method: 'POST' })
        const data = (await response.json()) as WalletAnswer
        if (cancelled) return
        if (response.status === 401) setAccount({ kind: 'signedOut' })
        else if (response.status === 200 && data.ok === true) {
          setAccount({
            kind: 'ready',
            balance: { free: data.free ?? 0, paid: data.paid ?? 0 },
            welcome: data.welcome ?? 'already',
          })
          const returned = new URLSearchParams(window.location.search).get('checkout_id')
          if (returned !== null && /^[A-Za-z0-9_-]{1,100}$/.test(returned)) setCheckoutId(returned)
        } else if (response.status === 503 && data.unconfigured === true && data.production === false) {
          setAccount({ kind: 'open' })
        } else setAccount({ kind: 'unavailable' })
      } catch {
        if (!cancelled) setAccount({ kind: 'unavailable' })
      }
    }
    void open()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // The visitor is shown the sign-in panel either way.
    }
    setAccount({ kind: 'signedOut' })
  }

  function setBalance(balance: Balance) {
    setAccount((current) => (current.kind === 'ready' ? { ...current, balance } : current))
  }

  if (account.kind === 'signedOut' || account.kind === 'unavailable') {
    return (
      <main className="workshop-page">
        <section className="workshop-empty">
          <p className="workshop-badge">{t.workshop.badge}</p>
          <h1>{t.workshop.emptyTitle}</h1>
          <p className="workshop-empty-lede">{t.workshop.emptyLede}</p>

          {account.kind === 'signedOut' ? (
            <AccountPanel locale={locale} authFailed={authFailed} />
          ) : (
            <p className="error-text account-unavailable" role="alert">
              {t.account.unavailable}
            </p>
          )}

          <p className="workshop-empty-note">
            {t.workshop.backPrompt} <Link href={localizedPath(locale, '/')}>{t.workshop.backLink}</Link>
          </p>
        </section>
      </main>
    )
  }

  const ready = account.kind === 'ready' ? account : null
  const welcome = ready ? welcomeText(ready.welcome, t) : null
  const empty = ready ? ready.balance.free + ready.balance.paid === 0 : false
  const bar = ready ? (
    <div className="account-bar">
      <CreditBadge
        locale={locale}
        free={ready.balance.free}
        paid={ready.balance.paid}
        onSignOut={handleSignOut}
        onBuy={() => setPacksOpen(true)}
      />
      {welcome ? <p className="account-welcome">{welcome}</p> : null}
      {checkoutId ? <CreditPurchaseStatus locale={locale} checkoutId={checkoutId} onCredited={(balance) => {
            setBalance(balance)
            setPacksOpen(false)
          }}
        /> : null}
      {empty ? <p className="account-no-credits">{t.account.noCredits}</p> : null}
      {empty || packsOpen ? <CreditPacks locale={locale} onClose={empty ? null : () => setPacksOpen(false)} /> : null}
    </div>
  ) : null

  if (!previewUrl) {
    return (
      <main className="workshop-page">
        {bar}
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
      {bar}
      <CartoonifyForm
        locale={locale}
        turnstileSiteKey={turnstileSiteKey}
        account={
          ready
            ? {
                balance: ready.balance,
                onBalance: setBalance,
                onSignedOut: () => setAccount({ kind: 'signedOut' }),
              }
            : undefined
        }
      />
    </main>
  )
}

function welcomeText(outcome: string, t: ReturnType<typeof getDictionary>): string | null {
  if (outcome === 'granted') return t.account.welcomeGranted
  if (outcome === 'ip_cap' || outcome === 'device_cap') return t.account.welcomeLimited
  if (outcome === 'email_used') return t.account.welcomeUsed
  if (outcome === 'email_unconfirmed') return t.account.emailUnconfirmed
  return null
}
