import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getAccountsEnv } from '@/lib/env'
import { createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Revokes this browser's session at Supabase and clears its cookies. */
export async function POST(): Promise<Response> {
  let revoked = true
  if (getAccountsEnv()) {
    try {
      // Local scope: this session only; the shared project's other sessions stay.
      await createAuthClient().auth.signOut({ scope: 'local' })
    } catch (unknownError) {
      revoked = false
      console.error('auth sign-out: revoke failed', unknownError)
    }
  }
  const store = cookies()
  for (const c of store.getAll()) {
    if (c.name.indexOf('sb-') === 0) store.set(c.name, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' })
  }
  return NextResponse.json({ ok: revoked }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
