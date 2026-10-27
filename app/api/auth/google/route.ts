import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/accounts'
import { getAccountsEnv } from '@/lib/env'
import { createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Starts Google sign-in: the PKCE verifier cookie is set here, then the visitor goes to Supabase. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  if (!getAccountsEnv()) return NextResponse.redirect(new URL(next + '?auth=failed', request.url), 302)
  try {
    const { data, error } = await createAuthClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: url.origin + '/api/auth/callback?next=' + encodeURIComponent(next),
        skipBrowserRedirect: true,
      },
    })
    if (error || !data.url) throw new Error('no authorize url')
    return NextResponse.redirect(data.url, 302)
  } catch (unknownError) {
    console.error('auth google: could not start', unknownError)
    return NextResponse.redirect(new URL(next + '?auth=failed', request.url), 302)
  }
}
