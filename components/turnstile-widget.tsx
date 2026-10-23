'use client'

import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      appearance: 'interaction-only'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('turnstile script failed'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

type Props = {
  siteKey: string
  /** The script loads only once this is true (after the consent box is first ticked). */
  active: boolean
  /** Bump to discard the used token and ask for a new one. */
  resetCount: number
  onToken: (token: string | null) => void
  onLoadError: () => void
}

export default function TurnstileWidget({ siteKey, active, resetCount, onToken, onLoadError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const onLoadErrorRef = useRef(onLoadError)
  onTokenRef.current = onToken
  onLoadErrorRef.current = onLoadError

  useEffect(() => {
    if (!active) return
    let cancelled = false
    loadScript().then(
      () => {
        const api = window.turnstile
        const container = containerRef.current
        if (cancelled || !api || !container || widgetRef.current !== null) return
        widgetRef.current = api.render(container, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null)
            onLoadErrorRef.current()
          },
        })
      },
      () => {
        if (!cancelled) onLoadErrorRef.current()
      },
    )
    return () => {
      cancelled = true
    }
  }, [active, siteKey])

  useEffect(() => {
    return () => {
      if (widgetRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetRef.current)
        widgetRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (resetCount === 0) return
    onTokenRef.current(null)
    if (widgetRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetRef.current)
    }
  }, [resetCount])

  return <div ref={containerRef} className="turnstile-slot" />
}
