import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/accounts'
import { getAccountsEnv } from '@/lib/env'
import { createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Trades the one-time code for a session, then goes back to the workshop. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const code = url.searchParams.get('code')
  const failed = () => NextResponse.redirect(new URL(next + '?auth=failed', request.url), 302)
  if (!code || url.searchParams.get('error') || !getAccountsEnv()) return failed()
  try {
    const { error } = await createAuthClient().auth.exchangeCodeForSession(code)
    if (error) return failed()
  } catch (unknownError) {
    console.error('auth callback: exchange failed', unknownError)
    return failed()
  }
  return NextResponse.redirect(new URL(next, request.url), 302)
}
