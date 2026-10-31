import { NextResponse } from 'next/server'
import { EMAIL_RATE_LIMITED_MESSAGE, INVALID_EMAIL_MESSAGE, safeNext, validEmail } from '@/lib/accounts'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv, publicOrigin } from '@/lib/env'
import { createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function unavailable(): Response {
  return NextResponse.json(
    { ok: false, code: 'SERVICE_UNAVAILABLE', message: ERROR_MESSAGES.SERVICE_UNAVAILABLE },
    { status: 503, headers: NO_STORE },
  )
}

/** Sends a sign-in link (no password). The answer is the same for known and new addresses. */
export async function POST(request: Request): Promise<Response> {
  if (!getAccountsEnv()) return unavailable()
  let body: { email?: unknown; next?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  const email = validEmail(body.email)
  if (email === null) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_EMAIL', message: INVALID_EMAIL_MESSAGE },
      { status: 400, headers: NO_STORE },
    )
  }
  const next = safeNext(body.next)
  const base = publicOrigin(request.url)

  try {
    const { error } = await createAuthClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: base +'/api/auth/callback?next=' + encodeURIComponent(next),
        shouldCreateUser: true,
      },
    })
    if (error) {
      if (error.status === 429) {
        return NextResponse.json(
          { ok: false, code: 'EMAIL_RATE_LIMITED', message: EMAIL_RATE_LIMITED_MESSAGE },
          { status: 429, headers: NO_STORE },
        )
      }
      console.error('auth email: sign-in link failed', error.status)
      return unavailable()
    }
  } catch (unknownError) {
    console.error('auth email: unreachable', unknownError)
    return unavailable()
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE })
}
