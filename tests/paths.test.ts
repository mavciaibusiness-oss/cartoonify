import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeNext } from '@/lib/accounts'
import { buildCheckoutRequest } from '@/lib/polar'
import { counterpartPath, localeOfPath, localizedPath } from '@/lib/i18n/paths'

const PAIRS = [
  ['/', '/tr'],
  ['/workshop', '/tr/workshop'],
  ['/account', '/tr/account'],
  ['/privacy', '/tr/privacy'],
  ['/terms', '/tr/terms'],
  ['/refund', '/tr/refund'],
  ['/cookies', '/tr/cookies'],
  ['/contact', '/tr/contact'],
] as const

test('maps every page to its counterpart in the other language', () => {
  for (const [en, tr] of PAIRS) {
    assert.equal(counterpartPath(en), tr)
    assert.equal(counterpartPath(tr), en)
    assert.equal(localeOfPath(en), 'en')
    assert.equal(localeOfPath(tr), 'tr')
  }
  assert.equal(counterpartPath('/tr/kvkk'), '/privacy')
  assert.equal(counterpartPath('/kvkk'), '/privacy')
  assert.equal(counterpartPath('/nope'), '/tr')
  assert.equal(counterpartPath('/tr/nope'), '/')
  assert.equal(localeOfPath('/track'), 'en')
  assert.equal(localeOfPath('/trx'), 'en')
  assert.equal(localizedPath('en', '/workshop'), '/workshop')
  assert.equal(localizedPath('tr', '/'), '/tr')
  assert.equal(localizedPath('tr', '/terms'), '/tr/terms')
})

test('keeps legacy /en/workshop sign-in links working', () => {
  assert.equal(safeNext('/en/workshop'), '/en/workshop')
  assert.equal(safeNext('/tr/workshop'), '/tr/workshop')
  assert.equal(safeNext('/workshop'), '/workshop')
  assert.equal(safeNext('//evil.example'), '/workshop')
  assert.equal(safeNext('/tr'), '/workshop')
  assert.equal(safeNext(null), '/workshop')
})

test('sends Polar back to the workshop in the buyer language', () => {
  const base = { productId: 'prod', userId: 'u', email: null, origin: 'https://o.example', pack: 'p10', environment: 'sandbox' } as const
  for (const [locale, path] of [['tr', '/tr/workshop'], ['en', '/workshop'], ['xx', '/tr/workshop']] as const) {
    const body = buildCheckoutRequest({ ...base, locale })
    assert.equal(body.success_url, 'https://o.example' + path + '?checkout_id={CHECKOUT_ID}')
    assert.equal(body.return_url, 'https://o.example' + path)
  }
})
