import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACCOUNT_ERROR_MESSAGES, isDeleteConfirmation, refundState } from '@/lib/account'
import { CARTOON_STYLES, STYLE_CATEGORIES } from '@/lib/cartoon-styles'
import { tr } from '@/lib/i18n/tr'
import { GET as sessionGet } from '@/app/api/session/route'
import { addUser, claim, h64, uid } from './wallet-db'
import { orderPaid, recordCheckout, refund } from './polar-db'
import { addMember, count, deleteAccount, openAccountDb, overview, service } from './account-db'

test('delete_account keeps the welcome e-mail hash', async () => {
  const db = await openAccountDb()
  await addUser(db, 1, 'Jane.Doe+promo@GMail.com')
  assert.equal((await claim(db, 1, 'a', 'a')).outcome, 'granted')
  assert.equal(await count(db, 'protoolhub.welcome_email_keys'), 1)
  const gone = await deleteAccount(db, 1)
  assert.deepEqual([gone.outcome, gone.keep_auth_user], ['deleted', false])
  for (const table of ['profiles', 'wallets', 'credit_ledger', 'welcome_grants']) {
    assert.equal(await count(db, 'protoolhub.' + table + ' where user_id = $1', [uid(1)]), 0, table)
  }
  assert.equal(await count(db, 'protoolhub.welcome_email_keys'), 1)
  assert.equal(await count(db, 'protoolhub.welcome_email_keys where email_key = $1', [h64('janedoe@gmail.com')]), 1)
  assert.equal((await deleteAccount(db, 1)).outcome, 'nothing')
  await addUser(db, 2, 'janedoe@googlemail.com')
  const back = await claim(db, 2, 'b', 'b')
  assert.deepEqual([back.outcome, back.free_credits], ['email_used', 0])
})

test('delete_account anonymises polar orders and checkouts', async () => {
  const db = await openAccountDb()
  await addUser(db, 1, 'buyer@example.com')
  await claim(db, 1, 'a', 'a')
  assert.equal((await recordCheckout(db, 'chk_a', 1, 'production', 'prod-10', 'p10')).outcome, 'recorded')
  assert.equal((await orderPaid(db, 'production', 'ord_a', 'chk_a', 1, 'prod-10', 399)).outcome, 'credited')
  assert.equal((await recordCheckout(db, 'chk_open', 1, 'production', 'prod-10', 'p10')).outcome, 'recorded')
  await deleteAccount(db, 1)
  const order = await db.query<{ user_id: string | null; net_amount: number; credits: number }>(
    "select user_id, net_amount, credits from protoolhub.polar_orders where order_id = 'ord_a'",
  )
  assert.deepEqual([order.rows[0].user_id, order.rows[0].net_amount, order.rows[0].credits], [null, 399, 10])
  const open = await db.query<{ user_id: string | null; status: string; refuse_reason: string }>(
    "select user_id, status, refuse_reason from protoolhub.polar_checkouts where checkout_id = 'chk_open'",
  )
  assert.deepEqual([open.rows[0].user_id, open.rows[0].status, open.rows[0].refuse_reason], [null, 'refused', 'account_deleted'])
  const late = await refund(db, 'production', 're_1', 'ord_a', 200, true)
  assert.equal(late.outcome, 'account_deleted')
  assert.equal(late.alert_shortfall, 0)
  const paidLate = await orderPaid(db, 'production', 'ord_late', 'chk_open', 1, 'prod-10', 399)
  assert.deepEqual([paidLate.outcome, paidLate.credits], ['account_deleted', 0])
})

test('account delete refuses without the DELETE confirmation', () => {
  assert.equal(isDeleteConfirmation({ confirm: 'DELETE' }), true)
  assert.equal(isDeleteConfirmation({ confirm: 'DELETE', user_id: 'x' }), true)
  for (const body of [null, undefined, {}, 'DELETE', [], { confirm: true }, { confirm: 'delete' }, { confirm: ['DELETE'] }]) {
    assert.equal(isDeleteConfirmation(body), false, JSON.stringify(body))
  }
  assert.equal(ACCOUNT_ERROR_MESSAGES.CONFIRM_REQUIRED, tr.errors.CONFIRM_REQUIRED)
  assert.equal(ACCOUNT_ERROR_MESSAGES.CONVERSION_IN_PROGRESS, tr.errors.CONVERSION_IN_PROGRESS)
})

test('account delete keeps the sign-in of a Firma Bulucu member', async () => {
  const db = await openAccountDb()
  await addUser(db, 1, 'member@example.com')
  await addUser(db, 2, 'plain@example.com')
  await claim(db, 1, 'a', 'a')
  await claim(db, 2, 'b', 'b')
  await addMember(db, 1)
  const members = JSON.stringify((await db.query('select * from leadgen.org_members order by user_id')).rows)
  const kept = await deleteAccount(db, 1)
  assert.deepEqual([kept.outcome, kept.keep_auth_user], ['deleted', true])
  const plain = await deleteAccount(db, 2)
  assert.deepEqual([plain.outcome, plain.keep_auth_user], ['deleted', false])
  assert.equal(JSON.stringify((await db.query('select * from leadgen.org_members order by user_id')).rows), members)
})

test('account delete is refused while a conversion is running', async () => {
  const db = await openAccountDb()
  await addUser(db, 1, 'busy@example.com')
  await claim(db, 1, 'a', 'a')
  await service(db, 'begin_conversion', [uid(1), 'cartoonify', 'classic'])
  assert.equal((await deleteAccount(db, 1)).outcome, 'busy')
  assert.equal(await count(db, 'protoolhub.profiles where user_id = $1', [uid(1)]), 1)
  await db.query("update protoolhub.conversions set created_at = now() - interval '11 minutes' where user_id = $1", [uid(1)])
  assert.equal((await deleteAccount(db, 1)).outcome, 'deleted')
})

test('account overview returns no order id and no amount', async () => {
  const db = await openAccountDb()
  await addUser(db, 1, 'reader@example.com')
  await claim(db, 1, 'a', 'a')
  await recordCheckout(db, 'chk_b', 1, 'production', 'prod-30', 'p30')
  await orderPaid(db, 'production', 'ord_b', 'chk_b', 1, 'prod-30', 999)
  await refund(db, 'production', 're_b1', 'ord_b', 100, true)
  const begun = await service(db, 'begin_conversion', [uid(1), 'cartoonify', 'pet-oil-portrait'])
  await service(db, 'complete_conversion', [begun.conversion_id])
  const o = await overview(db, 1)
  assert.deepEqual(Object.keys(o).sort(), ['conversions', 'free_credits', 'paid_credits', 'purchases'])
  const purchases = o.purchases as { pack: string; refund: string }[]
  assert.deepEqual(purchases.map((p) => [p.pack, p.refund]), [['p30', 'partial']])
  assert.deepEqual(Object.keys(purchases[0]).sort(), ['at', 'credits', 'pack', 'refund'])
  assert.deepEqual((o.conversions as { style: string }[]).map((c) => c.style), ['pet-oil-portrait'])
  assert.doesNotMatch(JSON.stringify(o), /ord_|chk_|999/)
  const none = await overview(db, 99)
  assert.deepEqual([none.free_credits, none.paid_credits, none.purchases, none.conversions], [0, 0, [], []])
  assert.equal(await count(db, 'protoolhub.profiles where user_id = $1', [uid(99)]), 0)
})

test('session route answers signedIn false without a session', async () => {
  const response = await sessionGet()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { signedIn: false })
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})

test('refundState tells none, partial and full apart', () => {
  assert.equal(refundState(399, 0), 'none')
  assert.equal(refundState(399, 1), 'partial')
  assert.equal(refundState(399, 399), 'full')
  assert.equal(refundState(399, 500), 'full')
})

test('the catalogue has 120 styles in 14 categories with 10 pet and 10 avatar styles', () => {
  assert.equal(CARTOON_STYLES.length, 120)
  assert.equal(STYLE_CATEGORIES.length, 14)
  assert.deepEqual(STYLE_CATEGORIES.slice(0, 3), ['cartoon', 'pet', 'avatar'])
  assert.equal(CARTOON_STYLES.filter((s) => s.category === 'pet').length, 10)
  assert.equal(CARTOON_STYLES.filter((s) => s.category === 'avatar').length, 10)
})
