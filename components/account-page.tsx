'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCartoonStyle, resolveCartoonStyleId } from '@/lib/cartoon-styles'
import { errorMessage, format, getDictionary, localizedPath, styleText, type Locale } from '@/lib/i18n'
import { PACKS } from '@/lib/packs'
import type { AccountConversion, AccountPurchase } from '@/lib/account'
import CreditPacks from './credit-packs'

type Overview = { email: string | null; free: number; paid: number; purchases: AccountPurchase[]; conversions: AccountConversion[] }

type State =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; data: Overview }
  | { kind: 'deleted'; auth: 'deleted' | 'kept_member' | 'failed' }

type AccountAnswer = {
  ok?: boolean
  email?: string | null
  free?: number
  paid?: number
  purchases?: AccountPurchase[]
  conversions?: AccountConversion[]
}

/**
 * The profile, shared by /account and /tr/account: credits, purchase history,
 * conversion history (no images; none are stored), language, sign-out and
 * account deletion. Every value comes from our own routes under /api.
 */
export default function AccountPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const p = t.profile
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [packsOpen, setPacksOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/account', { cache: 'no-store' })
        if (cancelled) return
        if (response.status === 401) {
          setState({ kind: 'signedOut' })
          return
        }
        const data = (await response.json()) as AccountAnswer
        if (cancelled) return
        if (response.status === 200 && data.ok === true) {
          setState({
            kind: 'ready',
            data: {
              email: data.email ?? null,
              free: data.free ?? 0,
              paid: data.paid ?? 0,
              purchases: Array.isArray(data.purchases) ? data.purchases : [],
              conversions: Array.isArray(data.conversions) ? data.conversions : [],
            },
          })
        } else setState({ kind: 'unavailable' })
      } catch {
        if (!cancelled) setState({ kind: 'unavailable' })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function signOut() {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // Leaving the page is the same either way.
    }
    window.location.assign(localizedPath(locale, '/'))
  }

  async function deleteAccount() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = (await response.json()) as { ok?: boolean; auth?: string; code?: string }
      if (response.status === 200 && data.ok === true) {
        const auth = data.auth === 'kept_member' || data.auth === 'failed' ? data.auth : 'deleted'
        setState({ kind: 'deleted', auth })
        return
      }
      setDeleteError(errorMessage(t, data.code ?? '', p.deleteError))
    } catch {
      setDeleteError(p.deleteError)
    }
    setDeleting(false)
  }

  const home = localizedPath(locale, '/')

  if (state.kind === 'loading') {
    return (
      <main className="account-page">
        <h1>{p.title}</h1>
        <p className="account-loading" role="status">
          {p.loading}
        </p>
      </main>
    )
  }

  if (state.kind === 'signedOut') {
    return (
      <main className="account-page">
        <h1>{p.title}</h1>
        <section className="account-signed-out">
          <p>{p.signedOut}</p>
          <Link className="generate-button account-signin" href={localizedPath(locale, '/workshop')}>
            {p.signIn}
          </Link>
        </section>
      </main>
    )
  }

  if (state.kind === 'unavailable') {
    return (
      <main className="account-page">
        <h1>{p.title}</h1>
        <p className="error-text account-unavailable" role="alert">
          {p.unavailable}
        </p>
      </main>
    )
  }

  if (state.kind === 'deleted') {
    const text = state.auth === 'kept_member' ? p.deletedKept : state.auth === 'failed' ? p.deletedFailed : p.deletedAll
    return (
      <main className="account-page">
        <h1>{p.title}</h1>
        <section className="account-deleted" data-auth={state.auth} role="status">
          <p>{text}</p>
          <Link href={home}>{p.home}</Link>
        </section>
      </main>
    )
  }

  const { data } = state
  const dateLocale = locale === 'en' ? 'en-GB' : 'tr-TR'
  const refundLabel = { none: p.refundNone, partial: p.refundPartial, full: p.refundFull }

  return (
    <main className="account-page">
      <h1>{p.title}</h1>
      {data.email ? <p className="account-email-line">{format(p.email, { email: data.email })}</p> : null}

      <section className="account-credits" aria-labelledby="account-credits-title">
        <h2 id="account-credits-title">{p.creditsTitle}</h2>
        <div className="account-balance" data-free={data.free} data-paid={data.paid}>
          <p>
            <span className="account-number">{data.free}</span>
            <span className="account-number-label">{p.free}</span>
          </p>
          <p>
            <span className="account-number">{data.paid}</span>
            <span className="account-number-label">{p.paid}</span>
          </p>
        </div>
        <button type="button" className="generate-button account-buy" onClick={() => setPacksOpen((open) => !open)}>
          {p.buy}
        </button>
        {packsOpen ? <CreditPacks locale={locale} onClose={() => setPacksOpen(false)} /> : null}
      </section>

      <section className="account-section" aria-labelledby="account-purchases-title">
        <h2 id="account-purchases-title">{p.purchasesTitle}</h2>
        {data.purchases.length === 0 ? (
          <>
            <img
              className="brand-mascot brand-mascot-small"
              src="/brand/mascot-240.webp"
              alt=""
              width={120}
              height={120}
              loading="lazy"
            />
            <p className="account-empty">{p.purchasesEmpty}</p>
          </>
        ) : (
          <ul className="account-purchases">
            {data.purchases.map((item, index) => {
              const pack = PACKS.find((candidate) => candidate.id === item.pack)
              return (
                <li key={index} data-pack={item.pack} data-refund={item.refund}>
                  <span>{new Date(item.at).toLocaleDateString(dateLocale)}</span>
                  <span>{format(t.credits.packCredits, { n: item.credits })}</span>
                  {pack ? <span>{pack.price}</span> : null}
                  <span>{refundLabel[item.refund] ?? p.refundNone}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="account-section" aria-labelledby="account-conversions-title">
        <h2 id="account-conversions-title">{p.conversionsTitle}</h2>
        {data.conversions.length === 0 ? (
          <p className="account-empty">{p.conversionsEmpty}</p>
        ) : (
          <ul className="account-conversions">
            {data.conversions.map((item, index) => {
              const id = resolveCartoonStyleId(item.style)
              const name = id ? styleText(getCartoonStyle(id), locale).name : item.style
              return (
                <li key={index} data-style={item.style} data-kind={item.kind}>
                  <span>{new Date(item.at).toLocaleDateString(dateLocale)}</span>
                  <span>{name}</span>
                  <span>{item.kind === 'paid' ? p.paid : p.free}</span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="account-note">{p.conversionsNote}</p>
      </section>

      <section className="account-section" aria-labelledby="account-language-title">
        <h2 id="account-language-title">{p.languageTitle}</h2>
        <p className="account-languages">
          <a className="account-lang" hrefLang="tr" href="/tr/account" lang="tr">
            {p.langTr}
          </a>
          <a className="account-lang" hrefLang="en" href="/account" lang="en">
            {p.langEn}
          </a>
        </p>
      </section>

      <section className="account-section">
        <button type="button" className="ghost-button account-signout" onClick={() => void signOut()}>
          {p.signOut}
        </button>
      </section>

      <section className="account-section account-danger" aria-labelledby="account-delete-title">
        <h2 id="account-delete-title">{p.deleteTitle}</h2>
        {confirming ? (
          <div className="account-delete-confirm" role="alertdialog" aria-describedby="account-delete-warning">
            <p id="account-delete-warning">{p.deleteWarning}</p>
            {deleteError ? (
              <p className="error-text" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="account-delete-actions">
              <button
                type="button"
                className="account-delete-yes"
                disabled={deleting}
                onClick={() => void deleteAccount()}
              >
                {deleting ? p.deleting : p.deleteYes}
              </button>
              <button
                type="button"
                className="ghost-button account-delete-cancel"
                disabled={deleting}
                onClick={() => {
                  setConfirming(false)
                  setDeleteError(null)
                }}
              >
                {p.deleteCancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="account-delete" onClick={() => setConfirming(true)}>
            {p.deleteButton}
          </button>
        )}
      </section>
    </main>
  )
}
