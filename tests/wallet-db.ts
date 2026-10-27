import crypto from 'node:crypto'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

/**
 * An in-process Postgres with stand-ins for the roles and auth.users, running
 * the real migration. No network, no real project.
 */

const PRELUDE = [
  'create role anon nologin',
  'create role authenticated nologin',
  'create role service_role nologin bypassrls',
  'create schema auth',
  'create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz)',
].join(';\n')

export async function openWalletDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(PRELUDE)
  await db.exec(fs.readFileSync('supabase/migrations/20261027000000_protoolhub_wallet.sql', 'utf8'))
  return db
}

export const uid = (n: number): string => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
export const h64 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')

export async function addUser(db: PGlite, n: number, email: string, confirmed = true): Promise<string> {
  await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, ' + (confirmed ? 'now()' : 'null') + ')', [
    uid(n),
    email,
  ])
  return uid(n)
}

/** Calls one of the four entry points as the service role. */
export async function callAsService(db: PGlite, fn: string, args: unknown[]): Promise<Record<string, unknown>> {
  await db.exec('set role service_role')
  try {
    const marks = args.map((_, i) => '$' + (i + 1)).join(', ')
    const result = await db.query<{ r: Record<string, unknown> }>('select protoolhub.' + fn + '(' + marks + ') as r', args)
    return result.rows[0].r
  } finally {
    await db.exec('reset role')
  }
}

export async function claim(db: PGlite, n: number, ip: string, device: string): Promise<Record<string, unknown>> {
  return callAsService(db, 'claim_welcome', [uid(n), 'cartoonify', h64('ip-' + ip), h64('dev-' + device)])
}
