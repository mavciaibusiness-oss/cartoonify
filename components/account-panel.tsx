'use client'

import { useState } from 'react'
import { errorMessage, getDictionary, type Locale } from '@/lib/i18n'

/**
 * The sign-in panel: a Google link and an e-mail link form. It replaces the
 * upload control until the visitor is signed in. It never talks to Supabase:
 * both paths are our own routes under /api/auth.
 */
export default function AccountPanel({ locale, authFailed }: { locale: Locale; authFailed: boolean }) {
  const t = getDictionary(locale)
  const next = locale === 'en' ? '/en/workshop' : '/workshop'
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, next }),
      })
      const data = (await response.json()) as { ok: boolean; code?: string; message?: string }
      if (data.ok) {
        setSent(true)
      } else {
        setError(errorMessage(t, data.code ?? 'SERVICE_UNAVAILABLE', data.message ?? t.account.unavailable))
      }
    } catch {
      setError(t.client.network)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="account-panel" aria-labelledby="account-panel-title">
      <h2 id="account-panel-title">{t.account.signInTitle}</h2>
      <p className="account-lede">{t.account.signInLede}</p>

      {authFailed ? (
        <p className="account-failed error-text" role="alert">
          {t.account.linkFailed}
        </p>
      ) : null}

      <a className="account-google" href={'/api/auth/google?next=' + next}>
        {t.account.google}
      </a>

      <form className="account-email" onSubmit={handleSubmit}>
        <label htmlFor="account-email-input">{t.account.emailLabel}</label>
        <input
          id="account-email-input"
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="generate-button" disabled={busy}>
          {t.account.emailSubmit}
        </button>
      </form>

      {sent ? (
        <p className="account-sent" role="status">
          {t.account.emailSent}
        </p>
      ) : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
