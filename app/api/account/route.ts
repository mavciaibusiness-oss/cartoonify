import { NextResponse } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv } from '@/lib/env'
import { accountOverview, getSessionUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function fail(code: 'AUTH_REQUIRED' | 'SERVICE_UNAVAILABLE', status: number) {
  return NextResponse.json({ ok: false, code, message: ERROR_MESSAGES[code] }, { status, headers: NO_STORE })
}

/** The profile page's data for the signed-in user. The user is always the session's. */
export async function GET(): Promise<Response> {
  if (!getAccountsEnv()) return fail('SERVICE_UNAVAILABLE', 503)

  let user
  try {
    user = await getSessionUser()
  } catch (unknownError) {
    console.error('account: auth unavailable', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (!user) return fail('AUTH_REQUIRED', 401)

  try {
    const overview = await accountOverview(user.id)
    return NextResponse.json(
      {
        ok: true,
        email: user.email,
        free: overview.free,
        paid: overview.paid,
        purchases: overview.purchases,
        conversions: overview.conversions,
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (unknownError) {
    console.error('account: overview failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
}
