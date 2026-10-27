import fs from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { openWalletDb, uid } from './wallet-db'

/** The wallet database with the Polar migration applied on top. No network, no real project. */
export async function openPolarDb(): Promise<PGlite> {
  const db = await openWalletDb()
  await db.exec(fs.readFileSync('supabase/migrations/20261028000000_protoolhub_polar.sql', 'utf8'))
  return db
}

export const PACK_CREDITS: Record<string, number> = { p10: 10, p30: 30, p75: 75 }

type Row = Record<string, unknown>

async function service(db: PGlite, fn: string, args: unknown[]): Promise<Row> {
  await db.exec('set role service_role')
  try {
    const marks = args.map((_, i) => '$' + (i + 1)).join(', ')
    const result = await db.query<{ r: Row }>('select protoolhub.' + fn + '(' + marks + ') as r', args)
    return result.rows[0].r
  } finally {
    await db.exec('reset role')
  }
}

export function recordCheckout(db: PGlite, checkout: string, user: number, env: string, product: string, pack: string) {
  return service(db, 'polar_record_checkout', [checkout, uid(user), env, product, pack, PACK_CREDITS[pack]])
}

export function orderPaid(
  db: PGlite,
  env: string,
  order: string,
  checkout: string,
  user: number,
  product: string,
  net: number,
) {
  return service(db, 'polar_order_paid', [env, order, checkout, uid(user), product, net, 'usd'])
}

export function refund(db: PGlite, env: string, key: string, order: string, amount: number, succeeded: boolean) {
  return service(db, 'polar_refund', [env, key, order, amount, succeeded])
}

export const markAlerted = (db: PGlite, order: string, shortfall: number) =>
  service(db, 'polar_mark_alerted', [order, shortfall])

export async function balance(db: PGlite, user: number): Promise<{ free: number; paid: number }> {
  const r = await db.query<{ f: number; p: number }>(
    'select free_credits as f, paid_credits as p from protoolhub.wallets where user_id = $1',
    [uid(user)],
  )
  return { free: r.rows[0]?.f ?? 0, paid: r.rows[0]?.p ?? 0 }
}
