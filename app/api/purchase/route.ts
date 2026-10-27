import { NextResponse } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv } from '@/lib/env'
import { PAYMENT_ERROR_MESSAGES, validPolarId } from '@/lib/polar'
import { checkoutStatus, getSessionUser } from '@/lib/supabase/server'

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

  const checkoutId = new URL(request.url).searchParams.get('checkout_id')
  if (!validPolarId(checkoutId)) return fail('INVALID_CHECKOUT', 400)

  try {
    const s = await checkoutStatus(user.id, checkoutId)
    return NextResponse.json(
      { ok: true, status: s.status, credits: s.credits, free: s.free, paid: s.paid },
      { status: 200, headers: NO_STORE },
    )
  } catch (unknownError) {
    console.error('purchase: status failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
}
