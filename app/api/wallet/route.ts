import { NextResponse } from 'next/server'
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  isDeviceId,
  keyedHash,
  newDeviceId,
  readCookie,
} from '@/lib/accounts'
import { ERROR_MESSAGES, TOOL_NAME } from '@/lib/cartoonify-handler'
import { getAbuseEnv, getAccountsEnv } from '@/lib/env'
import { clientIp } from '@/lib/rate-limit'
import { claimWelcome, getSessionUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function fail(code: 'AUTH_REQUIRED' | 'SERVICE_UNAVAILABLE', status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message: ERROR_MESSAGES[code], ...extra }, { status, headers: NO_STORE })
}

/**
 * Opens the wallet for the signed-in user and claims the welcome credits the
 * first time. The database decides the grant; this only passes keyed hashes.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getAccountsEnv()
  if (!env) {
    return fail('SERVICE_UNAVAILABLE', 503, { unconfigured: true, production: getAbuseEnv().isProduction })
  }

  let user
  try {
    user = await getSessionUser()
  } catch (unknownError) {
    console.error('wallet: auth unavailable', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (!user) return fail('AUTH_REQUIRED', 401)

  const existing = readCookie(request.headers.get('cookie'), DEVICE_COOKIE)
  const deviceId = isDeviceId(existing) ? existing : newDeviceId()
  const ipHash = keyedHash(env.hashSecret, 'ip', clientIp(request.headers))
  const deviceHash = keyedHash(env.hashSecret, 'device', deviceId)

  let result
  try {
    result = await claimWelcome(user.id, TOOL_NAME, ipHash, deviceHash)
  } catch (unknownError) {
    console.error('wallet: claim failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }

  const response = NextResponse.json(
    { ok: true, email: user.email, free: result.free, paid: result.paid, welcome: result.outcome },
    { status: 200, headers: NO_STORE },
  )
  if (deviceId !== existing) {
    response.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: DEVICE_COOKIE_MAX_AGE,
      secure: env.isProduction,
    })
  }
  return response
}
