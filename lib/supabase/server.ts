import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAccountsEnv, type AccountsEnv } from '@/lib/env'
import type { BeginResult, CreditsDeps, SessionUser } from '@/lib/cartoonify-handler'

/**
 * The only module besides lib/env.ts that handles the service-role key
 * (SUPABASE_SERVICE_ROLE_KEY, read in lib/env.ts). Both clients are created
 * per call, never at module scope, and the service client never leaves this
 * file: callers get the four wallet functions below, not a client.
 */

function requireEnv(): AccountsEnv {
  const env = getAccountsEnv()
  if (!env) throw new Error('accounts are not configured')
  return env
}

/** Session client (anon key, HttpOnly cookies). One per request. */
export function createAuthClient(): SupabaseClient {
  const env = requireEnv()
  const store = cookies()
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options)
        } catch {
          // Called where cookies are read-only; the session is refreshed on the next route call.
        }
      },
    },
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/' },
  })
}

/** Service client scoped to schema protoolhub. Internal; never exported. */
function createServiceClient(): SupabaseClient<any, 'protoolhub', 'protoolhub'> {
  const env = requireEnv()
  return createClient<any, 'protoolhub'>(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'protoolhub' },
  })
}

/**
 * The signed-in user from the session cookies. Null for no, unreadable or
 * rejected sessions; throws when Supabase Auth is unreachable or answering 5xx.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = createAuthClient()
  const { data, error } = await auth.auth.getUser()
  if (error) {
    const status = typeof error.status === 'number' ? error.status : 0
    const retryable = error.name === 'AuthRetryableFetchError' || status >= 500
    if (error.name === 'AuthSessionMissingError') return null
    if (retryable) throw new Error('auth unavailable')
    return null
  }
  if (!data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

type RpcRow = Record<string, unknown>

async function rpc(fn: string, args: Record<string, unknown>): Promise<RpcRow> {
  const { data, error } = await createServiceClient().rpc(fn, args)
  if (error) throw new Error('rpc ' + fn + ' failed')
  return (data ?? {}) as RpcRow
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0)

export type WelcomeResult = { outcome: string; free: number; paid: number }

export async function claimWelcome(
  userId: string,
  tool: string,
  ipHash: string,
  deviceHash: string,
): Promise<WelcomeResult> {
  const r = await rpc('claim_welcome', { p_user_id: userId, p_tool: tool, p_ip_hash: ipHash, p_device_hash: deviceHash })
  return { outcome: String(r.outcome ?? ''), free: num(r.free_credits), paid: num(r.paid_credits) }
}

export function createCredits(): CreditsDeps {
  return {
    begin: async (userId, tool, style): Promise<BeginResult> => {
      const r = await rpc('begin_conversion', { p_user_id: userId, p_tool: tool, p_style: style })
      const free = num(r.free_credits)
      const paid = num(r.paid_credits)
      if (r.ok !== true) return { ok: false, free, paid }
      return {
        ok: true,
        conversionId: String(r.conversion_id),
        kind: r.credit_kind === 'paid' ? 'paid' : 'free',
        free,
        paid,
      }
    },
    complete: async (conversionId) => {
      await rpc('complete_conversion', { p_conversion_id: conversionId })
    },
    refund: async (conversionId, reason) => {
      const r = await rpc('refund_conversion', { p_conversion_id: conversionId, p_reason: reason })
      return r.refunded === true
    },
  }
}
