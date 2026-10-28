-- Task 0026: read-only catalog check of schema protoolhub after all four migrations.
-- Supersedes supabase/checks/0024_live_catalog.sql, which reports the payment tables as
-- unexpected and looks for a SQL comment that applying through MCP strips (system
-- finding 1). Every assertion here reads code tokens or catalog facts, never comments.
-- Zero rows means every assertion holds; each row names one that does not.
select problem from (
  select 'expected table missing: protoolhub.' || x.n as problem
    from unnest(array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers', 'payment_checkouts', 'payment_orders']) as x(n)
   where to_regclass('protoolhub.' || x.n) is null
  union all
  select 'unexpected table: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> all (array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers', 'payment_checkouts', 'payment_orders'])
  union all
  select 'row level security is off: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'role ' || r.rolname || ' holds a privilege on protoolhub.' || c.relname
    from pg_class c cross join pg_roles r
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S')
     and r.rolname in ('anon', 'authenticated', 'service_role')
     and (case when c.relkind = 'S' then has_sequence_privilege(r.oid, c.oid, 'USAGE,SELECT,UPDATE')
               else has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end)
  union all
  select 'role ' || r.rolname || ' can use schema protoolhub'
    from pg_roles r
   where r.rolname in ('anon', 'authenticated') and has_schema_privilege(r.oid, 'protoolhub', 'USAGE')
  union all
  select 'service_role cannot use schema protoolhub'
   where not has_schema_privilege('service_role', 'protoolhub', 'USAGE')
  union all
  select 'not SECURITY DEFINER: ' || p.oid::regprocedure::text
    from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace and not p.prosecdef
  union all
  select 'search_path is not empty: ' || p.oid::regprocedure::text
    from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace
     and coalesce(p.proconfig, '{}'::text[]) <> array['search_path=""']
  union all
  select 'role ' || r.rolname || ' can execute ' || p.oid::regprocedure::text
    from pg_proc p cross join pg_roles r
   where p.pronamespace = 'protoolhub'::regnamespace and r.rolname in ('anon', 'authenticated')
     and has_function_privilege(r.oid, p.oid, 'EXECUTE')
  union all
  select 'PUBLIC can execute ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  union all
  select 'service_role cannot execute protoolhub.' || x.n
    from unnest(array['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)', 'polar_record_checkout(text,uuid,text,text,text,integer)', 'polar_order_paid(text,text,text,text,text,integer,text)', 'polar_refund(text,text,text,integer,boolean)', 'polar_mark_alerted(text,integer)', 'polar_checkout_status(uuid,text)', 'delete_account(uuid)', 'account_overview(uuid)', 'payment_record_checkout(text,text,uuid,text,text,integer,integer,text)', 'payment_checkout_paid(text,text,text,text,text,text,integer,integer,text)', 'payment_refund(text,text,text,integer,integer)', 'payment_dispute(text,text,text,text,text)', 'payment_mark_alerted(text,text,integer,text)', 'payment_checkout_status(uuid,text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or not has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'service_role can execute the internal ' || x.n
    from unnest(array['ensure_account(uuid,text)', 'polar_reconcile(text)', 'payment_reconcile(text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'unexpected function: ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and p.proname <> all (array['ensure_account', 'claim_welcome', 'begin_conversion', 'complete_conversion', 'refund_conversion', 'polar_reconcile', 'polar_record_checkout', 'polar_order_paid', 'polar_refund', 'polar_mark_alerted', 'polar_checkout_status', 'delete_account', 'account_overview', 'payment_reconcile', 'payment_record_checkout', 'payment_checkout_paid', 'payment_refund', 'payment_dispute', 'payment_mark_alerted', 'payment_checkout_status'])
  union all
  select 'a policy exists on protoolhub.' || pl.tablename
    from pg_policies pl where pl.schemaname = 'protoolhub'
  union all
  select 'a user trigger exists on auth.users: ' || tg.tgname
    from pg_trigger tg where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
  union all
  select 'a user trigger exists on protoolhub.' || tg.tgrelid::regclass::text
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where c.relnamespace = 'protoolhub'::regnamespace and not tg.tgisinternal
  union all
  select 'tool_costs does not price cartoonify at 1 active credit'
   where not exists (select 1 from protoolhub.tool_costs tc where tc.tool = 'cartoonify' and tc.credits = 1 and tc.active)
  union all
  select 'welcome_policy is not 2 credits, 3 per IP, 1 per device'
   where not exists (select 1 from protoolhub.welcome_policy wp where wp.free_credits = 2 and wp.per_ip_per_day = 3 and wp.per_device_per_day = 1)
  union all
  select 'welcome_email_keys is linked to another table: ' || con.conname
    from pg_constraint con
   where con.contype = 'f' and con.conrelid = to_regclass('protoolhub.welcome_email_keys')
  union all
  select 'credit_ledger.external_ref is not unique'
   where not exists (
     select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'protoolhub.credit_ledger'::regclass and i.indisunique and i.indnatts = 1 and a.attname = 'external_ref')
  union all
  select 'wallets lost a non-negative balance check'
   where (select count(*) from pg_constraint con
           where con.conrelid = 'protoolhub.wallets'::regclass and con.contype = 'c'
             and pg_get_constraintdef(con.oid) ~ '(free|paid)_credits >= 0') < 2
  union all
  select 'polar_orders.checkout_id is not unique'
   where not exists (
     select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'protoolhub.polar_orders'::regclass and i.indisunique and i.indnatts = 1 and a.attname = 'checkout_id')
  union all
  select 'polar_checkouts does not pin the credits of each pack'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = 'protoolhub.polar_checkouts'::regclass
                        and con.conname = 'polar_checkouts_pack_credits' and con.contype = 'c')
  union all
  select 'polar_refunds is linked to another table: ' || con.conname
    from pg_constraint con
   where con.contype = 'f' and con.conrelid = to_regclass('protoolhub.polar_refunds')
  union all
  select 'credits were added to a wallet without a matching ledger total: ' || w.user_id::text
    from protoolhub.wallets w
   where w.paid_credits <> coalesce((select sum(l.delta) from protoolhub.credit_ledger l where l.user_id = w.user_id and l.credit_kind = 'paid'), 0)
      or w.free_credits <> coalesce((select sum(l.delta) from protoolhub.credit_ledger l where l.user_id = w.user_id and l.credit_kind = 'free'), 0)
  union all
  select 'a purchase ledger row has no credited order: ' || l.external_ref
    from protoolhub.credit_ledger l
   where l.reason = 'purchase'
     and not exists (select 1 from protoolhub.polar_orders o where o.order_id = l.external_ref)
     and not exists (select 1 from protoolhub.payment_orders o where o.provider || ':' || o.checkout_ref = l.external_ref)
  union all
  select 'protoolhub.' || x.n || '.user_id is not nullable or not set null on delete'
    from unnest(array['polar_checkouts', 'polar_orders', 'payment_checkouts', 'payment_orders']) as x(n)
   where not exists (
     select 1 from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey) and a.attname = 'user_id'
      where con.conrelid = to_regclass('protoolhub.' || x.n) and con.contype = 'f'
        and con.confrelid = 'protoolhub.profiles'::regclass and con.confdeltype = 'n' and not a.attnotnull)
  union all
  select 'the owner of protoolhub.delete_account cannot read leadgen.org_members'
   where to_regprocedure('protoolhub.delete_account(uuid)') is not null
     and (to_regclass('leadgen.org_members') is null
          or not has_table_privilege((select p.proowner from pg_proc p where p.oid = to_regprocedure('protoolhub.delete_account(uuid)')),
                                     'leadgen.org_members', 'SELECT'))
  union all
  select 'leadgen.org_members has no user_id uuid column'
   where not exists (select 1 from pg_attribute a where a.attrelid = to_regclass('leadgen.org_members')
                       and a.attname = 'user_id' and a.atttypid = 'uuid'::regtype and not a.attisdropped)
  union all
  select 'missing the account_deleted guard: ' || x.n
    from unnest(array['polar_order_paid(text,text,text,text,text,integer,text)', 'polar_reconcile(text)', 'payment_checkout_paid(text,text,text,text,text,text,integer,integer,text)', 'payment_reconcile(text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or pg_get_functiondef(to_regprocedure('protoolhub.' || x.n)) not like '%account_deleted%'
  union all
  select 'does not handle the payment tables: ' || x.n
    from unnest(array['delete_account(uuid)', 'account_overview(uuid)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or pg_get_functiondef(to_regprocedure('protoolhub.' || x.n)) not like '%protoolhub.payment_orders%'
  union all
  select 'payment_orders is not one per checkout'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = to_regclass('protoolhub.payment_orders') and con.contype = 'u'
                        and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                              where a.attrelid = con.conrelid and a.attnum = any (con.conkey)) = array['checkout_ref', 'provider'])
  union all
  select 'payment_checkouts does not pin the credits and price of each pack'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = to_regclass('protoolhub.payment_checkouts') and con.contype = 'c'
                        and pg_get_constraintdef(con.oid) like '%1999%' and pg_get_constraintdef(con.oid) like '%usd%')
) checks;
