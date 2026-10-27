import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { PACKS } from '@/lib/packs'
import {
  PACK_CREDITS,
  PAYMENT_ERROR_MESSAGES,
  buildCheckoutRequest,
  mapEvent,
  parsePack,
  verifyWebhook,
} from '@/lib/polar'
import { tr } from '@/lib/i18n/tr'
import { en } from '@/lib/i18n/en'
import { addUser, claim, uid } from './wallet-db'
import { balance, markAlerted, openPolarDb, orderPaid, recordCheckout, refund } from './polar-db'

// The secret is computed, never written out: the prefix plus base64 of 32 bytes.
const SECRET = 'whsec_' + crypto.createHash('sha256').update('unit-test-webhook').digest('base64')
const OTHER = 'whsec_' + crypto.createHash('sha256').update('another-endpoint').digest('base64')
const BODY = '{"type":"order.paid","data":{"id":"ord_1"}}'
const NOW = 1_800_000_000

function sign(body: string, secret: string, id: string, ts: number, legacy = false): string {
  const key = legacy ? Buffer.from(secret, 'utf8') : Buffer.from(secret.slice(6), 'base64')
  return 'v1,' + crypto.createHmac('sha256', key).update(id + '.' + ts + '.' + body).digest('base64')
}

const headers = (id: string, ts: number, signature: string) => ({ id, timestamp: String(ts), signature })

test('rejects a webhook with a missing or wrong signature', () => {
  const good = sign(BODY, SECRET, 'msg_1', NOW)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, good), SECRET, NOW), true)
  assert.equal(verifyWebhook(BODY, { id: null, timestamp: null, signature: null }, SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, ''), SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, sign(BODY, OTHER, 'msg_1', NOW)), SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY + ' ', headers('msg_1', NOW, good), SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg_2', NOW, good), SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, 'v1a,' + good.slice(3)), SECRET, NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, good), '', NOW), false)
  assert.equal(verifyWebhook(BODY, headers('msg.1', NOW, sign(BODY, SECRET, 'msg.1', NOW)), SECRET, NOW), false)
})

test('rejects a webhook signed outside the five-minute window', () => {
  for (const [ts, ok] of [
    [NOW - 300, true],
    [NOW + 300, true],
    [NOW - 301, false],
    [NOW + 301, false],
    [NOW - 600, false],
  ] as const) {
    assert.equal(verifyWebhook(BODY, headers('msg_1', ts, sign(BODY, SECRET, 'msg_1', ts)), SECRET, NOW), ok, 'offset ' + (ts - NOW))
  }
  const good = sign(BODY, SECRET, 'msg_1', NOW)
  assert.equal(verifyWebhook(BODY, { id: 'msg_1', timestamp: '17e8', signature: good }, SECRET, NOW), false)
})

test('accepts both Standard Webhooks and legacy Polar keys', () => {
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, sign(BODY, SECRET, 'msg_1', NOW)), SECRET, NOW), true)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, sign(BODY, SECRET, 'msg_1', NOW, true)), SECRET, NOW), true)
  const stale = 'v1,' + Buffer.from('nope').toString('base64')
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, stale + ' ' + sign(BODY, SECRET, 'msg_1', NOW)), SECRET, NOW), true)
  assert.equal(verifyWebhook(BODY, headers('msg_1', NOW, sign(BODY, OTHER, 'msg_1', NOW, true)), SECRET, NOW), false)
})

test('credits a paid order once even when the webhook is replayed', async () => {
  const db = await openPolarDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  assert.equal((await recordCheckout(db, 'chk_a', 1, 'production', 'prod-10', 'p10')).outcome, 'recorded')
  assert.equal((await recordCheckout(db, 'chk_a', 1, 'production', 'prod-10', 'p10')).outcome, 'already')
  const first = await orderPaid(db, 'production', 'ord_a', 'chk_a', 1, 'prod-10', 399)
  assert.deepEqual([first.outcome, first.credits, first.paid_credits], ['credited', 10, 10])
  for (let i = 0; i < 3; i++) {
    const again = await orderPaid(db, 'production', 'ord_a', 'chk_a', 1, 'prod-10', 399)
    assert.deepEqual([again.outcome, again.paid_credits], ['duplicate', 10])
  }
  const second = await orderPaid(db, 'production', 'ord_b', 'chk_a', 1, 'prod-10', 399)
  assert.notEqual(second.outcome, 'credited')
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 10 })
  const rows = await db.query("select count(*)::int as n from protoolhub.credit_ledger where reason = 'purchase'")
  assert.equal((rows.rows[0] as { n: number }).n, 1)
})

test('does not credit an order from another environment', async () => {
  const db = await openPolarDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  await recordCheckout(db, 'chk_p', 1, 'production', 'prod-30', 'p30')
  const wrongEnv = await orderPaid(db, 'sandbox', 'ord_p', 'chk_p', 1, 'prod-30', 999)
  assert.equal(wrongEnv.outcome, 'environment_mismatch')
  assert.equal((await balance(db, 1)).paid, 0)
  const wrongEnvRetry = await orderPaid(db, 'production', 'ord_p2', 'chk_p', 1, 'prod-30', 999)
  assert.deepEqual([wrongEnvRetry.outcome, wrongEnvRetry.paid_credits], ['credited', 30])
  const cases: Array<[string, number, string, number, string]> = [
    ['chk_u', 2, 'prod-30', 999, 'user_mismatch'],
    ['chk_q', 1, 'prod-75', 999, 'product_mismatch'],
    ['chk_z', 1, 'prod-30', 0, 'zero_amount'],
  ]
  for (const [checkout, user, product, net, want] of cases) {
    await recordCheckout(db, checkout, 1, 'production', 'prod-30', 'p30')
    const r = await orderPaid(db, 'production', 'ord_' + checkout, checkout, user, product, net)
    assert.equal(r.outcome, want)
    assert.equal((await balance(db, 1)).paid, 30)
  }
})

test('deducts refunds proportionally, rounded up, and never below zero', async () => {
  const db = await openPolarDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  await recordCheckout(db, 'chk_1', 1, 'production', 'prod-30', 'p30')
  await orderPaid(db, 'production', 'ord_1', 'chk_1', 1, 'prod-30', 999)
  const pending = await refund(db, 'production', 'ref_1', 'ord_1', 100, false)
  assert.equal(pending.deducted_credits, 0)
  const partial = await refund(db, 'production', 'ref_1', 'ord_1', 100, true)
  assert.deepEqual([partial.deducted_credits, partial.paid_credits], [4, 26])
  const rest = await refund(db, 'production', 'ref_2', 'ord_1', 899, true)
  assert.deepEqual([rest.deducted_credits, rest.paid_credits], [30, 0])

  await recordCheckout(db, 'chk_2', 1, 'production', 'prod-10', 'p10')
  await orderPaid(db, 'production', 'ord_2', 'chk_2', 1, 'prod-10', 399)
  await db.query('update protoolhub.wallets set paid_credits = 2 where user_id = $1', [uid(1)])
  await db.query(
    "insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after) values ($1, 'paid', -8, 'conversion', 'test-spend', 2, 2)",
    [uid(1)],
  )
  const full = await refund(db, 'production', 'order:ord_2', 'ord_2', 399, true)
  assert.deepEqual([full.deducted_credits, full.shortfall_credits, full.alert_shortfall], [2, 8, 8])
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 0 })
  assert.equal((await markAlerted(db, 'ord_2', 8)).alerted_shortfall, 8)
  const after = await refund(db, 'production', 'order:ord_2', 'ord_2', 399, true)
  assert.equal(after.alert_shortfall, 0)
})

test('does not deduct the same refund twice', async () => {
  const db = await openPolarDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  await recordCheckout(db, 'chk_1', 1, 'production', 'prod-30', 'p30')
  await orderPaid(db, 'production', 'ord_1', 'chk_1', 1, 'prod-30', 999)
  await refund(db, 'production', 'ref_1', 'ord_1', 100, true)
  for (const [key, amount] of [
    ['ref_1', 100],
    ['order:ord_1', 100],
    ['ref_1', 100],
  ] as const) {
    const r = await refund(db, 'production', key, 'ord_1', amount, true)
    assert.deepEqual([r.deducted_credits, r.paid_credits], [4, 26], key)
  }
  const rows = await db.query("select delta from protoolhub.credit_ledger where reason = 'adjustment'")
  assert.deepEqual(
    rows.rows.map((x) => (x as { delta: number }).delta),
    [-4],
  )
})

test('credits sandbox orders only to sandbox testers', async () => {
  const db = await openPolarDb()
  await addUser(db, 1, 'plain@example.com')
  await addUser(db, 2, 'tester@example.com')
  await claim(db, 1, 'a', 'a')
  await claim(db, 2, 'b', 'b')
  assert.equal((await recordCheckout(db, 'chk_s1', 1, 'sandbox', 'sb-10', 'p10')).outcome, 'sandbox_not_allowed')
  await db.query('insert into protoolhub.sandbox_testers (user_id) values ($1)', [uid(2)])
  assert.equal((await recordCheckout(db, 'chk_s2', 2, 'sandbox', 'sb-75', 'p75')).outcome, 'recorded')
  const r = await orderPaid(db, 'sandbox', 'ord_s2', 'chk_s2', 2, 'sb-75', 1999)
  assert.deepEqual([r.outcome, r.paid_credits], ['credited', 75])
  assert.equal((await balance(db, 1)).paid, 0)
})

test('maps verified events to database calls using the deployment environment', () => {
  const paid = {
    type: 'order.paid',
    data: {
      id: 'ord_1',
      status: 'paid',
      paid: true,
      billing_reason: 'purchase',
      checkout_id: 'chk_1',
      product_id: 'prod-10',
      net_amount: 399,
      currency: 'usd',
      customer: { external_id: 'user-1' },
      environment: 'production',
    },
  }
  assert.deepEqual(mapEvent(paid, 'sandbox'), {
    kind: 'order_paid',
    environment: 'sandbox',
    orderId: 'ord_1',
    checkoutId: 'chk_1',
    customerExternalId: 'user-1',
    productId: 'prod-10',
    netAmount: 399,
    currency: 'usd',
  })
  assert.equal(mapEvent({ ...paid, data: { ...paid.data, billing_reason: 'subscription_cycle' } }, 'sandbox').kind, 'ignore')
  assert.equal(mapEvent({ ...paid, data: { ...paid.data, status: 'pending', paid: false } }, 'sandbox').kind, 'ignore')
  assert.equal(mapEvent({ type: 'checkout.updated', data: {} }, 'sandbox').kind, 'ignore')
  assert.deepEqual(mapEvent({ type: 'order.refunded', data: { id: 'ord_1', refunded_amount: 150 } }, 'sandbox'), {
    kind: 'refund',
    environment: 'sandbox',
    refundKey: 'order:ord_1',
    orderId: 'ord_1',
    amount: 150,
    succeeded: true,
  })
  const updated = { type: 'refund.updated', data: { id: 'ref_1', order_id: 'ord_1', amount: 150, status: 'pending' } }
  assert.deepEqual(mapEvent(updated, 'sandbox'), {
    kind: 'refund',
    environment: 'sandbox',
    refundKey: 'ref_1',
    orderId: 'ord_1',
    amount: 150,
    succeeded: false,
  })
})

test('builds a checkout request from server values only', () => {
  const base = { productId: 'prod-10', userId: 'user-1', origin: 'https://site.test', pack: 'p10', environment: 'sandbox' } as const
  const body = buildCheckoutRequest({ ...base, email: 'buyer@example.com', locale: 'en' })
  assert.deepEqual(body.products, ['prod-10'])
  assert.equal(body.external_customer_id, 'user-1')
  assert.equal(body.success_url, 'https://site.test/en/workshop?checkout_id={CHECKOUT_ID}')
  assert.equal(body.allow_discount_codes, false)
  assert.deepEqual(body.metadata, { pth_user_id: 'user-1', pth_pack: 'p10', pth_env: 'sandbox' })
  const anonymous = buildCheckoutRequest({ ...base, email: null, locale: 'tr' })
  assert.equal('customer_email' in anonymous, false)
  assert.equal(anonymous.return_url, 'https://site.test/workshop')
})

test('accepts only the three pack ids and keeps the packs and texts consistent', () => {
  assert.equal(parsePack('p30'), 'p30')
  for (const bad of ['P30', 'p99', '', null, 30, { pack: 'p10' }]) assert.equal(parsePack(bad), null)
  for (const pack of PACKS) assert.equal(PACK_CREDITS[pack.id], pack.credits)
  for (const code of ['INVALID_PACK', 'SANDBOX_TESTERS_ONLY', 'INVALID_CHECKOUT'] as const) {
    assert.equal(PAYMENT_ERROR_MESSAGES[code], tr.errors[code])
    assert.ok(en.errors[code].length > 0)
  }
})
