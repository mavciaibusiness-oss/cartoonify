import { NextResponse } from 'next/server'
import { getAccountsEnv, getPaymentsEnv } from '@/lib/env'
import {
  WEBHOOK_MAX_BYTES,
  accountOf,
  mapEvent,
  sendShortfallAlert,
  verifyWebhook,
} from '@/lib/polar'
import { markAlerted, orderPaid, polarRefund } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function answer(status: number): Response {
  return NextResponse.json({ ok: status < 400 }, { status, headers: NO_STORE })
}

/**
 * Polar's signed webhook. Nothing is parsed or stored before the signature
 * over the raw body has been verified. Every database function is idempotent,
 * so a failure answers 500 and Polar's retry is safe.
 */
export async function POST(request: Request): Promise<Response> {
  const payments = getPaymentsEnv()
  if (!payments || !getAccountsEnv()) return answer(503)

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > WEBHOOK_MAX_BYTES) return answer(413)

  const verified = verifyWebhook(
    raw,
    {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    payments.webhookSecret,
    Math.floor(Date.now() / 1000),
  )
  if (!verified) return answer(403)

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    return answer(400)
  }

  const action = mapEvent(event, payments.environment)
  if (action.kind === 'ignore') return answer(202)

  let alertShortfall = 0
  let orderId: string | null = null
  try {
    if (action.kind === 'order_paid') {
      const r = await orderPaid(action)
      alertShortfall = r.alertShortfall
      orderId = action.orderId
    } else {
      const r = await polarRefund(action)
      alertShortfall = r.alertShortfall
      orderId = action.orderId
    }
  } catch (unknownError) {
    console.error('polar webhook: database call failed', unknownError)
    return answer(500)
  }

  if (alertShortfall > 0 && orderId !== null) {
    if (!payments.resend) {
      console.error('polar webhook: credits could not be taken back, order ' + orderId + ', credits ' + alertShortfall)
      return answer(202)
    }
    const sent = await sendShortfallAlert(payments.resend, {
      orderId,
      environment: payments.environment,
      accountId: accountOf(event),
      credits: alertShortfall,
    })
    if (!sent) return answer(500)
    try {
      await markAlerted(orderId, alertShortfall)
    } catch (unknownError) {
      console.error('polar webhook: marking the alert failed', unknownError)
      return answer(500)
    }
  }
  return answer(202)
}
