import { NextResponse } from 'next/server'
import { getAccountsEnv } from '@/lib/env'
import { getSessionUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Whether this browser is signed in. Always 200 with exactly one key; any
 * trouble (no configuration, no session, Auth unreachable) answers false.
 * It makes no database call.
 */
export async function GET(): Promise<Response> {
  let signedIn = false
  if (getAccountsEnv()) {
    try {
      signedIn = (await getSessionUser()) !== null
    } catch {
      signedIn = false
    }
  }
  return NextResponse.json({ signedIn }, { status: 200, headers: NO_STORE })
}
