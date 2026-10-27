'use client'

import { useEffect, useRef, useState } from 'react'
import { format, getDictionary, type Locale } from '@/lib/i18n'

const POLL_MS = 1500
const MAX_CALLS = 12

type View = { kind: 'processing' } | { kind: 'added'; credits: number } | { kind: 'refused' } | { kind: 'slow' }

type PurchaseAnswer = { ok?: boolean; status?: string; credits?: number; free?: number; paid?: number }

/**
 * Shown on the return from checkout. Asks /api/purchase at once and then every
 * 1 500 ms, at most 12 times, until the webhook has credited the order.
 */
export default function CreditPurchaseStatus({
  locale,
  checkoutId,
  onCredited,
}: {
  locale: Locale
  checkoutId: string
  onCredited: (balance: { free: number; paid: number }) => void
}) {
  const t = getDictionary(locale)
  const [view, setView] = useState<View>({ kind: 'processing' })
  const credited = useRef(onCredited)
  credited.current = onCredited

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let calls = 0

    async function poll() {
      calls += 1
      let data: PurchaseAnswer = {}
      try {
        const response = await fetch('/api/purchase?checkout_id=' + encodeURIComponent(checkoutId))
        if (response.status === 200) data = (await response.json()) as PurchaseAnswer
      } catch {
        data = {}
      }
      if (cancelled) return
      if (data.ok === true && data.status === 'credited') {
        credited.current({ free: data.free ?? 0, paid: data.paid ?? 0 })
        setView({ kind: 'added', credits: data.credits ?? 0 })
        return
      }
      if (data.ok === true && data.status === 'refused') {
        setView({ kind: 'refused' })
        return
      }
      if (calls >= MAX_CALLS) {
        setView({ kind: 'slow' })
        return
      }
      timer = setTimeout(() => void poll(), POLL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [checkoutId])

  const text =
    view.kind === 'added'
      ? format(t.credits.added, { n: view.credits })
      : view.kind === 'refused'
        ? t.credits.refused
        : view.kind === 'slow'
          ? t.credits.stillProcessing
          : t.credits.processing

  return (
    <p className={'credit-purchase-status' + (view.kind === 'refused' ? ' error-text' : '')} role="status">
      {text}
    </p>
  )
}
