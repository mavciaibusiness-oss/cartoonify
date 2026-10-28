import { NextResponse } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv } from '@/lib/env'
import { PAYMENT_ERROR_MESSAGES, validSessionId } from '@/lib/stripe'
import { getSessionUser, paymentCheckoutStatus } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function fail(code: 'AUTH_REQUIRED' | 'SERVICE_UNAVAILABLE' | 'INVALID_CHECKOUT', status: number): Response {
  const message = code === 'INVALID_CHECKOUT' ? PAYMENT_ERROR_MESSAGES.INVALID_CHECKOUT : ERROR_MESSAGES[code]
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE })
}

/** The state of one of the signed-in user's own checkouts, for the return page to poll. */
export async function GET(request: Request): Promise<Response> {
  if (!getAccountsEnv()) return fail('SERVICE_UNAVAILABLE', 503)

  let user
  try {
    user = await getSessionUser()
  } catch (unknownError) {
    console.error('purchase: auth unavailable', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (!user) return fail('AUTH_REQUIRED', 401)

  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!validSessionId(sessionId)) return fail('INVALID_CHECKOUT', 400)

  try {
    const s = await paymentCheckoutStatus(user.id, 'stripe', sessionId)
    return NextResponse.json(
      { ok: true, status: s.status, credits: s.credits, free: s.free, paid: s.paid },
      { status: 200, headers: NO_STORE },
    )
  } catch (unknownError) {
    console.error('purchase: status failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
}
