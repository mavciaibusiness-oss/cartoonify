import { NextResponse } from 'next/server'
import { getAccountsEnv, getPaymentsEnv, paymentsEnvProblem } from '@/lib/env'
import {
  WEBHOOK_MAX_BYTES,
  accountOf,
  checkWebhook,
  mapEvent,
  sendShortfallAlert,
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
  if (!payments) {
    console.warn('polar webhook: rejected 503 reason=payments_off ' + paymentsEnvProblem())
    return answer(503)
  }
  if (!getAccountsEnv()) {
    console.warn('polar webhook: rejected 503 reason=accounts_off')
    return answer(503)
  }

  const raw = await request.text()
  const bytes = Buffer.byteLength(raw, 'utf8')
  if (bytes > WEBHOOK_MAX_BYTES) {
    console.warn('polar webhook: rejected 413 reason=body_too_large bytes=' + bytes)
    return answer(413)
  }

  const check = checkWebhook(
    raw,
    {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    payments.webhookSecret,
    Math.floor(Date.now() / 1000),
  )
  if (!check.ok) {
    console.warn('polar webhook: rejected 403 reason=' + check.reason + ' ' + check.detail)
    return answer(403)
  }

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    console.warn('polar webhook: rejected 400 reason=invalid_json bytes=' + bytes)
    return answer(400)
  }

  const action = mapEvent(event, payments.environment)
  if (action.kind === 'ignore') {
    const type = typeof (event as { type?: unknown })?.type === 'string' ? String((event as { type: string }).type).slice(0, 60) : 'unknown'
    console.warn('polar webhook: ignored 202 type=' + type)
    return answer(202)
  }

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
