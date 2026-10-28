import fs from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { openAccountDb, service } from './account-db'
import { uid } from './wallet-db'

/** The wallet, Polar and account databases with the Stripe migration on top. No network, no real project. */
export async function openStripeDb(): Promise<PGlite> {
  const db = await openAccountDb()
  await db.exec(fs.readFileSync('supabase/migrations/20261030000000_protoolhub_stripe.sql', 'utf8'))
  return db
}

export const PACK_CREDITS: Record<string, number> = { p10: 10, p30: 30, p75: 75 }
export const PACK_PRICE: Record<string, number> = { p10: 399, p30: 999, p75: 1999 }

export function record(db: PGlite, checkout: string, user: number, env: string, pack: string) {
  return service(db, 'payment_record_checkout', [
    'stripe',
    checkout,
    uid(user),
    env,
    pack,
    PACK_CREDITS[pack],
    PACK_PRICE[pack],
    'usd',
  ])
}

export function paid(
  db: PGlite,
  env: string,
  checkout: string,
  payment: string,
  user: number,
  pack: string,
  amount = PACK_PRICE[pack],
) {
  return service(db, 'payment_checkout_paid', ['stripe', env, checkout, payment, uid(user), pack, amount, 0, 'usd'])
}

export const refund = (db: PGlite, env: string, payment: string, charge: number, refunded: number) =>
  service(db, 'payment_refund', ['stripe', env, payment, charge, refunded])

export const dispute = (db: PGlite, env: string, payment: string, ref: string, status: string) =>
  service(db, 'payment_dispute', ['stripe', env, payment, ref, status])

export const markAlerted = (db: PGlite, payment: string, shortfall: number, status: string | null) =>
  service(db, 'payment_mark_alerted', ['stripe', payment, shortfall, status])
