'use client'

import { useState } from 'react'
import { errorMessage, format, getDictionary, type Locale } from '@/lib/i18n'
import { PACKS, type PackId } from '@/lib/packs'

/**
 * The three credit packs. A buy button sends the pack and the language, and
 * nothing else, to our own /api/checkout, then follows the address it returns.
 * The browser never sends a price, a credit count, a product or a user.
 */
export default function CreditPacks({ locale, onClose }: { locale: Locale; onClose: (() => void) | null }) {
  const t = getDictionary(locale)
  const [busy, setBusy] = useState<PackId | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buy(pack: PackId) {
    if (busy) return
    setBusy(pack)
    setError(null)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pack, locale }),
      })
      const data = (await response.json()) as { ok?: boolean; url?: string; code?: string; message?: string }
      if (response.status === 200 && data.ok === true && typeof data.url === 'string') {
        window.location.assign(data.url)
        return
      }
      setError(response.status === 503 ? t.credits.unavailable : errorMessage(t, data.code ?? '', t.credits.unavailable))
    } catch {
      setError(t.credits.unavailable)
    }
    setBusy(null)
  }

  return (
    <section className="credit-packs" aria-labelledby="credit-packs-title">
      <h2 id="credit-packs-title">{t.credits.packsTitle}</h2>
      <p className="credit-packs-lede">{t.credits.packsLede}</p>

      <div className="credit-pack-list">
        {PACKS.map((pack) => (
          <div key={pack.id} className="credit-pack" data-pack={pack.id}>
            <p className="credit-pack-credits">{format(t.credits.packCredits, { n: pack.credits })}</p>
            <p className="credit-pack-price">{pack.price}</p>
            <button
              type="button"
              className="generate-button credit-pack-buy"
              disabled={busy !== null}
              onClick={() => void buy(pack.id)}
            >
              {busy === pack.id ? t.credits.redirecting : t.credits.packBuy}
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p className="error-text credit-packs-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="credit-merchant">{t.credits.merchant}</p>
      {onClose ? (
        <button type="button" className="ghost-button credit-packs-close" onClick={onClose}>
          {t.credits.close}
        </button>
      ) : null}
    </section>
  )
}
