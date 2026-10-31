import { NextResponse } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv, getStripeEnv, paymentProvider, publicOrigin } from '@/lib/env'
import {
  PACK_CREDITS,
  PACK_PRICE_CENTS,
  PAYMENT_ERROR_MESSAGES,
  buildStripeCheckoutParams,
  createStripeCheckout,
  parsePack,
} from '@/lib/stripe'
import { getSessionUser, recordPaymentCheckout } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

type Code = 'AUTH_REQUIRED' | 'SERVICE_UNAVAILABLE' | 'INVALID_PACK' | 'SANDBOX_TESTERS_ONLY'

function fail(code: Code, status: number): Response {
  const message = code === 'INVALID_PACK' || code === 'SANDBOX_TESTERS_ONLY' ? PAYMENT_ERROR_MESSAGES[code] : ERROR_MESSAGES[code]
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE })
}

/**
 * Starts a Checkout Session for the signed-in user. The browser names only a
 * pack and a language; the price, the user and the credits all come from the server.
 */
export async function POST(request: Request): Promise<Response> {
  const accounts = getAccountsEnv()
  const payments = getStripeEnv()
  if (!accounts || paymentProvider() !== 'stripe' || !payments) return fail('SERVICE_UNAVAILABLE', 503)

  let user
  try {
    user = await getSessionUser()
  } catch (unknownError) {
    console.error('checkout: auth unavailable', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (!user) return fail('AUTH_REQUIRED', 401)

  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await request.json()
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    body = {}
  }
  const pack = parsePack(body.pack)
  if (pack === null) return fail('INVALID_PACK', 400)
  const locale = body.locale === 'en' ? 'en' : 'tr'

  const session = await createStripeCheckout(
    payments.apiBase,
    payments.secretKey,
    buildStripeCheckoutParams({
      userId: user.id,
      email: user.email,
      origin: publicOrigin(request.url),
      locale,
      pack,
      environment: payments.environment,
    }),
  )
  if (!session) return fail('SERVICE_UNAVAILABLE', 503)

  let outcome: string
  try {
    outcome = await recordPaymentCheckout({
      provider: 'stripe',
      checkoutRef: session.id,
      userId: user.id,
      environment: payments.environment,
      pack,
      credits: PACK_CREDITS[pack],
      amount: PACK_PRICE_CENTS[pack],
      currency: 'usd',
    })
  } catch (unknownError) {
    console.error('checkout: recording failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (outcome === 'sandbox_not_allowed') return fail('SANDBOX_TESTERS_ONLY', 403)

  return NextResponse.json({ ok: true, url: session.url }, { status: 200, headers: NO_STORE })
}
