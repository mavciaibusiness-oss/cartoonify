import fs from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { openPolarDb } from './polar-db'
import { uid } from './wallet-db'

/**
 * The wallet and Polar databases with the account migration on top, and a
 * stand-in for leadgen.org_members (the live columns). No network, no real project.
 */
export async function openAccountDb(): Promise<PGlite> {
  const db = await openPolarDb()
  await db.exec(
    'create schema leadgen;' +
      'create table leadgen.org_members (org_id uuid, user_id uuid references auth.users (id) on delete cascade, role text, created_at timestamptz not null default now());' +
      'alter table leadgen.org_members enable row level security',
  )
  await db.exec(fs.readFileSync('supabase/migrations/20261029000000_protoolhub_account.sql', 'utf8'))
  return db
}

type Row = Record<string, unknown>

export async function service(db: PGlite, fn: string, args: unknown[]): Promise<Row> {
  await db.exec('set role service_role')
  try {
    const marks = args.map((_, i) => '$' + (i + 1)).join(', ')
    const result = await db.query<{ r: Row }>('select protoolhub.' + fn + '(' + marks + ') as r', args)
    return result.rows[0].r
  } finally {
    await db.exec('reset role')
  }
}

export const deleteAccount = (db: PGlite, user: number) => service(db, 'delete_account', [uid(user)])
export const overview = (db: PGlite, user: number) => service(db, 'account_overview', [uid(user)])

export async function addMember(db: PGlite, user: number): Promise<void> {
  await db.query("insert into leadgen.org_members (org_id, user_id, role) values ($1, $2, 'owner')", [uid(900), uid(user)])
}

export async function count(db: PGlite, sql: string, args: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>('select count(*)::int as n from ' + sql, args)
  return r.rows[0].n
}
