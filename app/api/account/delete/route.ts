import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ACCOUNT_ERROR_MESSAGES, isDeleteConfirmation } from '@/lib/account'
import { ERROR_MESSAGES } from '@/lib/cartoonify-handler'
import { getAccountsEnv } from '@/lib/env'
import { createAuthClient, deleteAccountData, deleteAuthUser, getSessionUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

type Code = 'AUTH_REQUIRED' | 'SERVICE_UNAVAILABLE' | 'CONFIRM_REQUIRED' | 'CONVERSION_IN_PROGRESS'

function fail(code: Code, status: number) {
  const message = code === 'CONFIRM_REQUIRED' || code === 'CONVERSION_IN_PROGRESS' ? ACCOUNT_ERROR_MESSAGES[code] : ERROR_MESSAGES[code]
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE })
}

/**
 * Deletes the signed-in user's account. Order: confirmation, then the
 * protoolhub records (one transaction), then the sign-in account unless the
 * person is a Firma Bulucu member, then the local sign-out.
 */
export async function POST(request: Request): Promise<Response> {
  if (!getAccountsEnv()) return fail('SERVICE_UNAVAILABLE', 503)

  let user
  try {
    user = await getSessionUser()
  } catch (unknownError) {
    console.error('account-delete: auth unavailable', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (!user) return fail('AUTH_REQUIRED', 401)

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!isDeleteConfirmation(body)) return fail('CONFIRM_REQUIRED', 400)

  let result
  try {
    result = await deleteAccountData(user.id)
  } catch (unknownError) {
    console.error('account-delete: records failed', unknownError)
    return fail('SERVICE_UNAVAILABLE', 503)
  }
  if (result.outcome === 'busy') return fail('CONVERSION_IN_PROGRESS', 409)

  let auth: 'deleted' | 'kept_member' | 'failed' = 'kept_member'
  if (!result.keepAuthUser) {
    const removed = await deleteAuthUser(user.id)
    if (removed) {
      auth = 'deleted'
    } else {
      auth = 'failed'
      // The account id only; never the e-mail address.
      console.error('account-delete: auth delete failed', user.id)
    }
  }

  try {
    await createAuthClient().auth.signOut({ scope: 'local' })
  } catch {
    // The cookies are cleared below either way.
  }
  const store = cookies()
  for (const c of store.getAll()) {
    if (c.name.indexOf('sb-') === 0) store.set(c.name, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' })
  }
  return NextResponse.json({ ok: true, auth }, { status: 200, headers: NO_STORE })
}
