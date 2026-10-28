import { NextResponse } from 'next/server'
import { getAccountsEnv, getStripeEnv, stripeEnvProblem } from '@/lib/env'
import { WEBHOOK_MAX_BYTES, constructEvent, mapEvent, sendPaymentAlert } from '@/lib/stripe'
import {
  markPaymentAlerted,
  paymentCheckoutPaid,
  paymentDispute,
  paymentRefund,
  type PaymentResult,
} from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function answer(status: number): Response {
  return NextResponse.json({ received: status < 400 }, { status, headers: NO_STORE })
}

/**
 * The signed webhook. Nothing is parsed or stored before the signature over
 * the raw body has been verified. Every database function is idempotent, so a
 * failure answers 500 and the retry is safe.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getStripeEnv()
  if (!env) {
    console.warn('payment webhook: rejected 503 reason=payments_off ' + stripeEnvProblem())
    return answer(503)
  }
  if (!getAccountsEnv()) {
    console.warn('payment webhook: rejected 503 reason=accounts_off')
    return answer(503)
  }

  const raw = await request.text()
  const bytes = Buffer.byteLength(raw, 'utf8')
  if (bytes > WEBHOOK_MAX_BYTES) {
    console.warn('payment webhook: rejected 413 reason=body_too_large bytes=' + bytes)
    return answer(413)
  }

  const check = constructEvent(raw, request.headers.get('stripe-signature'), env.webhookSecret, Math.floor(Date.now() / 1000))
  if (!check.ok) {
    console.warn('payment webhook: rejected 400 reason=' + check.reason)
    return answer(400)
  }
  const event = check.event
  if (event.livemode !== env.livemode) return answer(200)

  const action = mapEvent(event)
  if (action.kind === 'ignore') return answer(200)

  let result: PaymentResult
  try {
    if (action.kind === 'checkout_paid') {
      result = await paymentCheckoutPaid({
        provider: 'stripe',
        environment: env.environment,
        checkoutRef: action.checkoutRef,
        paymentRef: action.paymentRef,
        userRef: action.userRef,
        pack: action.pack,
        amountPaid: action.amountPaid,
        amountTax: action.amountTax,
        currency: action.currency,
      })
    } else if (action.kind === 'refund') {
      result = await paymentRefund({
        provider: 'stripe',
        environment: env.environment,
        paymentRef: action.paymentRef,
        chargeAmount: action.chargeAmount,
        refundedAmount: action.refundedAmount,
      })
    } else {
      result = await paymentDispute({
        provider: 'stripe',
        environment: env.environment,
        paymentRef: action.paymentRef,
        disputeRef: action.disputeRef,
        status: action.status,
      })
    }
  } catch (unknownError) {
    console.error('payment webhook: database call failed', unknownError)
    return answer(500)
  }

  if (action.kind !== 'checkout_paid' && result.outcome === 'not_ours') {
    // Marked as ours but not credited yet: the completion has not arrived, so Stripe retries.
    return answer(action.marked ? 500 : 200)
  }

  const paymentRef = action.paymentRef
  const disputeStatus = result.alertDispute
  if (result.alertShortfall > 0 || disputeStatus !== null) {
    if (!env.resend) {
      console.error(
        'payment webhook: alert not mailed, payment ' + paymentRef + ', credits ' + result.alertShortfall +
          ', dispute ' + String(disputeStatus),
      )
      return answer(200)
    }
    const sent = await sendPaymentAlert(env.resend, {
      paymentRef,
      environment: env.environment,
      accountId: result.accountId,
      credits: result.alertShortfall,
      disputeStatus,
    })
    if (!sent) return answer(500)
    try {
      await markPaymentAlerted('stripe', paymentRef, result.alertShortfall, disputeStatus)
    } catch (unknownError) {
      console.error('payment webhook: marking the alert failed', unknownError)
      return answer(500)
    }
  }
  return answer(200)
}
