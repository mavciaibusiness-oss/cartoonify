import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAccountsEnv, type AccountsEnv } from '@/lib/env'
import type { AccountOverview, RefundState } from '@/lib/account'
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

/* ------------------------------------------------------ Polar purchases */

export type PurchaseOutcome = { outcome: string; alertShortfall: number }

/** Records a checkout the server just created. The outcome is 'recorded', 'already' or 'sandbox_not_allowed'. */
export async function recordCheckout(
  checkoutId: string,
  userId: string,
  environment: string,
  productId: string,
  pack: string,
  credits: number,
): Promise<string> {
  const r = await rpc('polar_record_checkout', {
    p_checkout_id: checkoutId,
    p_user_id: userId,
    p_environment: environment,
    p_product_id: productId,
    p_pack: pack,
    p_credits: credits,
  })
  return String(r.outcome ?? '')
}

/** order.paid. The database refuses anything that does not match the checkout. */
export async function orderPaid(args: {
  environment: string
  orderId: string | null
  checkoutId: string | null
  customerExternalId: string | null
  productId: string | null
  netAmount: number | null
  currency: string | null
}): Promise<PurchaseOutcome> {
  const r = await rpc('polar_order_paid', {
    p_environment: args.environment,
    p_order_id: args.orderId,
    p_checkout_id: args.checkoutId,
    p_customer_external_id: args.customerExternalId,
    p_product_id: args.productId,
    p_net_amount: args.netAmount,
    p_currency: args.currency,
  })
  return { outcome: String(r.outcome ?? ''), alertShortfall: num(r.alert_shortfall) }
}

/** order.refunded, refund.created and refund.updated. Idempotent. */
export async function polarRefund(args: {
  environment: string
  refundKey: string | null
  orderId: string | null
  amount: number | null
  succeeded: boolean
}): Promise<PurchaseOutcome> {
  const r = await rpc('polar_refund', {
    p_environment: args.environment,
    p_refund_key: args.refundKey,
    p_order_id: args.orderId,
    p_amount: args.amount,
    p_succeeded: args.succeeded,
  })
  return { outcome: String(r.outcome ?? ''), alertShortfall: num(r.alert_shortfall) }
}

/** Marks a shortfall as e-mailed to the operator. */
export async function markAlerted(orderId: string, shortfall: number): Promise<void> {
  await rpc('polar_mark_alerted', { p_order_id: orderId, p_shortfall: shortfall })
}

export type CheckoutStatus = { status: 'pending' | 'credited' | 'refused' | 'unknown'; credits: number; free: number; paid: number }

/** The state of one of the user's own checkouts, with the wallet. */
export async function checkoutStatus(userId: string, checkoutId: string): Promise<CheckoutStatus> {
  const r = await rpc('polar_checkout_status', { p_user_id: userId, p_checkout_id: checkoutId })
  const s = r.status
  const status = s === 'pending' || s === 'credited' || s === 'refused' ? s : 'unknown'
  return { status, credits: num(r.credits), free: num(r.free_credits), paid: num(r.paid_credits) }
}

/* ------------------------------------------------------ Card payments (Stripe) */

export type PaymentResult = {
  outcome: string
  alertShortfall: number
  alertDispute: string | null
  accountId: string | null
}

function paymentResult(r: RpcRow): PaymentResult {
  return {
    outcome: String(r.outcome ?? ''),
    alertShortfall: num(r.alert_shortfall),
    alertDispute: typeof r.alert_dispute === 'string' ? r.alert_dispute : null,
    accountId: typeof r.account_id === 'string' ? r.account_id : null,
  }
}

/** Records a checkout session the server just created. The outcome is 'recorded', 'already' or 'sandbox_not_allowed'. */
export async function recordPaymentCheckout(args: {
  provider: string
  checkoutRef: string
  userId: string
  environment: string
  pack: string
  credits: number
  amount: number
  currency: string
}): Promise<string> {
  const r = await rpc('payment_record_checkout', {
    p_provider: args.provider,
    p_checkout_ref: args.checkoutRef,
    p_user_id: args.userId,
    p_environment: args.environment,
    p_pack: args.pack,
    p_credits: args.credits,
    p_amount: args.amount,
    p_currency: args.currency,
  })
  return String(r.outcome ?? '')
}

/** A paid checkout. The database refuses anything that does not match the recorded checkout. */
export async function paymentCheckoutPaid(args: {
  provider: string
  environment: string
  checkoutRef: string
  paymentRef: string
  userRef: string | null
  pack: string | null
  amountPaid: number
  amountTax: number
  currency: string
}): Promise<PaymentResult> {
  const r = await rpc('payment_checkout_paid', {
    p_provider: args.provider,
    p_environment: args.environment,
    p_checkout_ref: args.checkoutRef,
    p_payment_ref: args.paymentRef,
    p_user_ref: args.userRef,
    p_pack: args.pack,
    p_amount_paid: args.amountPaid,
    p_amount_tax: args.amountTax,
    p_currency: args.currency,
  })
  return paymentResult(r)
}

/** A refund, with the charge's cumulative refunded amount. Idempotent. */
export async function paymentRefund(args: {
  provider: string
  environment: string
  paymentRef: string
  chargeAmount: number
  refundedAmount: number
}): Promise<PaymentResult> {
  const r = await rpc('payment_refund', {
    p_provider: args.provider,
    p_environment: args.environment,
    p_payment_ref: args.paymentRef,
    p_charge_amount: args.chargeAmount,
    p_refunded_amount: args.refundedAmount,
  })
  return paymentResult(r)
}

/** A dispute opened or closed. Idempotent. */
export async function paymentDispute(args: {
  provider: string
  environment: string
  paymentRef: string
  disputeRef: string
  status: string
}): Promise<PaymentResult> {
  const r = await rpc('payment_dispute', {
    p_provider: args.provider,
    p_environment: args.environment,
    p_payment_ref: args.paymentRef,
    p_dispute_ref: args.disputeRef,
    p_status: args.status,
  })
  return paymentResult(r)
}

/** Marks a shortfall and a dispute status as e-mailed to the operator. */
export async function markPaymentAlerted(
  provider: string,
  paymentRef: string,
  shortfall: number,
  disputeStatus: string | null,
): Promise<void> {
  await rpc('payment_mark_alerted', {
    p_provider: provider,
    p_payment_ref: paymentRef,
    p_shortfall: shortfall,
    p_dispute_status: disputeStatus,
  })
}

/** The state of one of the user's own payment checkouts, with the wallet. */
export async function paymentCheckoutStatus(
  userId: string,
  provider: string,
  checkoutRef: string,
): Promise<CheckoutStatus> {
  const r = await rpc('payment_checkout_status', {
    p_user_id: userId,
    p_provider: provider,
    p_checkout_ref: checkoutRef,
  })
  const s = r.status
  const status = s === 'pending' || s === 'credited' || s === 'refused' ? s : 'unknown'
  return { status, credits: num(r.credits), free: num(r.free_credits), paid: num(r.paid_credits) }
}

/* ------------------------------------------------------ Profile and deletion */

const REFUNDS: readonly RefundState[] = ['none', 'partial', 'full']

/** The profile page's data for one user. Read only; a user with no profile gets zeros and empty lists. */
export async function accountOverview(userId: string): Promise<AccountOverview> {
  const r = await rpc('account_overview', { p_user_id: userId })
  const rows = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []
  return {
    free: num(r.free_credits),
    paid: num(r.paid_credits),
    purchases: rows(r.purchases).map((p) => ({
      at: String(p.at ?? ''),
      pack: String(p.pack ?? ''),
      credits: num(p.credits),
      refund: REFUNDS.includes(p.refund as RefundState) ? (p.refund as RefundState) : 'none',
    })),
    conversions: rows(r.conversions).map((c) => ({
      at: String(c.at ?? ''),
      style: String(c.style ?? ''),
      kind: c.kind === 'paid' ? 'paid' : 'free',
    })),
  }
}

export type DeleteAccountResult = { outcome: 'deleted' | 'nothing' | 'busy'; keepAuthUser: boolean }

/** One transaction in the database: refuses while a conversion runs, anonymises Polar records, deletes the profile. */
export async function deleteAccountData(userId: string): Promise<DeleteAccountResult> {
  const r = await rpc('delete_account', { p_user_id: userId })
  const o = r.outcome
  if (o !== 'deleted' && o !== 'nothing' && o !== 'busy') throw new Error('rpc delete_account answered an unknown outcome')
  return { outcome: o, keepAuthUser: r.keep_auth_user !== false }
}

/** Hard-deletes the sign-in account through the Supabase Auth Admin API. True on success, false on any failure. */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  try {
    const { error } = await createServiceClient().auth.admin.deleteUser(userId)
    return !error
  } catch {
    return false
  }
}
