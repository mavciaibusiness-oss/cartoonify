import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { test } from 'node:test'
import { getStripeEnv, paymentProvider, polarEnabled, stripeEnvProblem } from '@/lib/env'
import { buildStripeCheckoutParams, constructEvent, mapEvent } from '@/lib/stripe'
import { addUser, claim, uid } from './wallet-db'
import { balance } from './polar-db'
import { dispute, markAlerted, openStripeDb, paid, record, refund } from './stripe-db'

// Secrets and keys are computed, never written out.
const digest = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const SECRET = 'whsec' + '_' + digest('stripe-unit-secret').slice(0, 40)
const OTHER = 'whsec' + '_' + digest('stripe-other-secret').slice(0, 40)
const TEST_KEY = 'sk' + '_test' + '_' + digest('stripe-test-key').slice(0, 30)
const LIVE_KEY = 'sk' + '_live' + '_' + digest('stripe-live-key').slice(0, 30)
const NOW = 1_800_000_000
// The settings module reads the live variables on every call; the test edits it through this handle.
const proc = (globalThis as unknown as { process: object }).process
const environ = Reflect.get(proc, 'env') as Record<string, string | undefined>

function header(body: string, secret: string, ts: number, scheme = 'v1'): string {
  return 't=' + ts + ',' + scheme + '=' + crypto.createHmac('sha256', secret).update(ts + '.' + body).digest('hex')
}

const BODY = JSON.stringify({
  id: 'evt_1',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { id: 'cs_test_x' } },
})

test('verifies a Stripe signature and rejects a wrong, missing or stale one', () => {
  const ok = constructEvent(BODY, header(BODY, SECRET, NOW), SECRET, NOW)
  assert.equal(ok.ok, true)
  if (ok.ok) assert.equal(ok.event.id, 'evt_1')
  const rolled = 't=' + NOW + ',v1=' + '0'.repeat(64) + ',v1=' + header(BODY, SECRET, NOW).split('v1=')[1]
  assert.equal(constructEvent(BODY, rolled, SECRET, NOW).ok, true)
  assert.equal(constructEvent(BODY, header(BODY, SECRET, NOW - 299), SECRET, NOW).ok, true)
  const bad: Array<[string, string | null, string]> = [
    [BODY, null, SECRET],
    [BODY, '', SECRET],
    [BODY, header(BODY, OTHER, NOW), SECRET],
    [BODY.replace('cs_test_x', 'cs_test_y'), header(BODY, SECRET, NOW), SECRET],
    [BODY, header(BODY, SECRET, NOW - 301), SECRET],
    [BODY, header(BODY, SECRET, NOW + 301), SECRET],
    [BODY, header(BODY, SECRET, NOW, 'v0'), SECRET],
    [BODY, header(BODY, SECRET, NOW).replace('t=' + NOW + ',', ''), SECRET],
    [BODY, header(BODY, SECRET, NOW), ''],
    ['{"id":', header('{"id":', SECRET, NOW), SECRET],
  ]
  for (const [b, h, s] of bad) assert.equal(constructEvent(b, h, s, NOW).ok, false)
})

test('builds the Stripe checkout from server values only', () => {
  const p = buildStripeCheckoutParams({
    userId: uid(7),
    email: 'buyer@example.com',
    origin: 'https://o.example',
    locale: 'en',
    pack: 'p30',
    environment: 'sandbox',
  })
  const keys = [...p.keys()]
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '999')
  assert.equal(p.get('line_items[0][price_data][tax_behavior]'), 'inclusive')
  assert.equal(p.get('automatic_tax[enabled]'), 'true')
  assert.equal(p.get('success_url'), 'https://o.example/workshop?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(p.get('metadata[pth_pack]'), 'p30')
  assert.equal(p.get('payment_intent_data[metadata][pth_env]'), 'sandbox')
  assert.equal(p.get('customer_email'), 'buyer@example.com')
  assert.equal(p.toString().includes('payment_method_types'), false)
  const tr = buildStripeCheckoutParams({
    userId: uid(8),
    email: null,
    origin: 'https://o.example',
    locale: 'xx',
    pack: 'p10',
    environment: 'production',
  })
  assert.equal(tr.has('customer_email'), false)
  assert.equal(tr.get('locale'), 'tr')
  assert.equal(tr.get('cancel_url'), 'https://o.example/tr/workshop')
})

test('credits a paid Stripe checkout once even when the webhook is replayed', async () => {
  const db = await openStripeDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  assert.equal((await record(db, 'cs_test_a', 1, 'production', 'p10')).outcome, 'recorded')
  assert.equal((await record(db, 'cs_test_a', 1, 'production', 'p10')).outcome, 'already')
  const first = await paid(db, 'production', 'cs_test_a', 'pi_a', 1, 'p10')
  assert.deepEqual([first.outcome, first.credits], ['credited', 10])
  for (let i = 0; i < 3; i++) {
    assert.equal((await paid(db, 'production', 'cs_test_a', 'pi_a', 1, 'p10')).outcome, 'duplicate')
  }
  assert.notEqual((await paid(db, 'production', 'cs_test_a', 'pi_b', 1, 'p10')).outcome, 'credited')
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 10 })
  const rows = await db.query("select count(*)::int as n from protoolhub.credit_ledger where reason = 'purchase'")
  assert.equal((rows.rows[0] as { n: number }).n, 1)
  await record(db, 'cs_test_c', 1, 'production', 'p30')
  assert.equal((await paid(db, 'sandbox', 'cs_test_c', 'pi_c', 1, 'p30')).outcome, 'environment_mismatch')
  assert.equal((await paid(db, 'production', 'cs_test_c', 'pi_c', 1, 'p10')).outcome, 'pack_mismatch')
  assert.equal((await balance(db, 1)).paid, 10)
})

test('ignores events of other products on the shared Stripe account', () => {
  const session = (o: Record<string, unknown>) => ({
    id: 'evt',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_test_1',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: 'pi_1',
        client_reference_id: uid(1),
        amount_total: 999,
        currency: 'usd',
        metadata: { app: 'protoolhub', pth_pack: 'p30' },
        ...o,
      },
    },
  })
  assert.equal(mapEvent(session({})).kind, 'checkout_paid')
  for (const o of [
    { metadata: { app: 'other-product', companyId: uid(5) } },
    { metadata: { companyId: uid(5) } },
    { metadata: {} },
    { mode: 'subscription' },
    { payment_status: 'unpaid' },
  ]) {
    assert.equal(mapEvent(session(o)).kind, 'ignore')
  }
  const charge = (o: Record<string, unknown>) => ({
    type: 'charge.refunded',
    data: { object: { amount: 999, amount_refunded: 300, payment_intent: 'pi_1', metadata: {}, ...o } },
  })
  assert.equal(mapEvent(charge({})).kind, 'refund')
  assert.equal(mapEvent(charge({ metadata: { app: 'other-product' } })).kind, 'ignore')
  assert.equal(mapEvent(charge({ payment_intent: null })).kind, 'ignore')
  assert.equal(mapEvent({ type: 'invoice.paid', data: { object: { id: 'in_1' } } }).kind, 'ignore')
  const foreignDispute = {
    type: 'charge.dispute.created',
    data: { object: { id: 'dp_1', status: 'needs_response', payment_intent: 'pi_1', metadata: { app: 'other-product' } } },
  }
  assert.equal(mapEvent(foreignDispute).kind, 'ignore')
})

test('deducts Stripe refunds proportionally from the cumulative amount, rounded up, never below zero', async () => {
  const db = await openStripeDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  await record(db, 'cs_test_1', 1, 'production', 'p30')
  await paid(db, 'production', 'cs_test_1', 'pi_1', 1, 'p30')
  assert.equal((await refund(db, 'production', 'pi_1', 999, 100)).deducted_credits, 4)
  assert.equal((await refund(db, 'production', 'pi_1', 999, 100)).deducted_credits, 4)
  assert.equal((await refund(db, 'production', 'pi_1', 999, 50)).deducted_credits, 4)
  assert.equal((await balance(db, 1)).paid, 26)
  assert.equal((await refund(db, 'production', 'pi_1', 999, 999)).deducted_credits, 30)
  assert.equal((await balance(db, 1)).paid, 0)
  assert.equal((await refund(db, 'production', 'pi_unknown', 999, 999)).outcome, 'not_ours')

  await record(db, 'cs_test_2', 1, 'production', 'p10')
  await paid(db, 'production', 'cs_test_2', 'pi_2', 1, 'p10')
  await db.query('update protoolhub.wallets set paid_credits = 2 where user_id = $1', [uid(1)])
  const full = await refund(db, 'production', 'pi_2', 399, 399)
  assert.deepEqual([full.deducted_credits, full.shortfall_credits, full.alert_shortfall], [2, 8, 8])
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 0 })
  assert.equal((await markAlerted(db, 'pi_2', 8, null)).alerted_shortfall, 8)
  assert.equal((await refund(db, 'production', 'pi_2', 399, 399)).alert_shortfall, 0)
})

test('takes the whole pack back on a dispute and gives nothing back when it is won', async () => {
  const db = await openStripeDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  await record(db, 'cs_test_1', 1, 'production', 'p30')
  await paid(db, 'production', 'cs_test_1', 'pi_1', 1, 'p30')
  const opened = await dispute(db, 'production', 'pi_1', 'dp_1', 'needs_response')
  assert.deepEqual([opened.deducted_credits, opened.alert_dispute], [30, 'needs_response'])
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 0 })
  await markAlerted(db, 'pi_1', 0, 'needs_response')
  const won = await dispute(db, 'production', 'pi_1', 'dp_1', 'won')
  assert.equal(won.alert_dispute, 'won')
  assert.deepEqual(await balance(db, 1), { free: 2, paid: 0 })
  const late = await dispute(db, 'production', 'pi_1', 'dp_1', 'needs_response')
  assert.notEqual(late.alert_dispute, 'needs_response')
  const after = await refund(db, 'production', 'pi_1', 999, 999)
  assert.equal(after.shortfall_credits, 0)
  assert.equal((await dispute(db, 'production', 'pi_foreign', 'dp_2', 'needs_response')).outcome, 'not_ours')
})

test('refuses a live key outside production and a test key in production', () => {
  const names = [
    'VERCEL_ENV',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYMENT_PROVIDER',
    'RESEND_API_KEY',
    'OPERATOR_ALERT_EMAIL',
    'STRIPE_API_BASE_URL',
  ]
  const saved: Record<string, string | undefined> = {}
  for (const n of names) saved[n] = environ[n]
  const set = (o: Record<string, string>) => {
    for (const n of names) delete environ[n]
    for (const [k, v] of Object.entries(o)) environ[k] = v
  }
  try {
    const base = {
      STRIPE_WEBHOOK_SECRET: SECRET,
      RESEND_API_KEY: 'resend-' + digest('r').slice(0, 20),
      OPERATOR_ALERT_EMAIL: 'ops@example.org',
    }
    set({ ...base, STRIPE_SECRET_KEY: TEST_KEY })
    assert.equal(getStripeEnv()?.environment, 'sandbox')
    assert.equal(getStripeEnv()?.livemode, false)
    assert.equal(stripeEnvProblem(), '')
    set({ ...base, STRIPE_SECRET_KEY: LIVE_KEY })
    assert.equal(getStripeEnv(), null)
    assert.equal(stripeEnvProblem().includes(LIVE_KEY), false)
    assert.notEqual(stripeEnvProblem(), '')
    set({ ...base, VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: LIVE_KEY })
    assert.equal(getStripeEnv(), null)
    set({ ...base, VERCEL_ENV: 'production', STRIPE_SECRET_KEY: TEST_KEY })
    assert.equal(getStripeEnv(), null)
    set({ ...base, VERCEL_ENV: 'production', STRIPE_SECRET_KEY: LIVE_KEY })
    assert.equal(getStripeEnv()?.environment, 'production')
    assert.equal(getStripeEnv()?.livemode, true)
    set({ STRIPE_WEBHOOK_SECRET: SECRET, VERCEL_ENV: 'production', STRIPE_SECRET_KEY: LIVE_KEY })
    assert.equal(getStripeEnv(), null)
    set({ ...base, STRIPE_SECRET_KEY: TEST_KEY, PAYMENT_PROVIDER: ' Polar ' })
    assert.equal(paymentProvider(), 'polar')
    assert.equal(polarEnabled(), false)
    set({})
    assert.equal(paymentProvider(), 'stripe')
  } finally {
    for (const n of names) {
      if (saved[n] === undefined) delete environ[n]
      else environ[n] = saved[n]
    }
  }
})
