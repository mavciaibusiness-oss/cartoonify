-- Task 0022 live catalog check. Read-only: one SELECT, nothing written.
-- Zero rows means every assertion holds; each row names one that does not.
select problem from (
  select 'expected table missing: protoolhub.' || x.n as problem
    from unnest(array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys']) as x(n)
   where to_regclass('protoolhub.' || x.n) is null
  union all
  select 'unexpected table: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> all (array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys'])
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
    from unnest(array['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or not has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'a policy exists on protoolhub.' || pl.tablename
    from pg_policies pl where pl.schemaname = 'protoolhub'
  union all
  select 'a user trigger exists on auth.users: ' || tg.tgname
    from pg_trigger tg where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
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
  select 'welcome_email_keys has an unexpected column: ' || a.attname
    from pg_attribute a
   where a.attrelid = to_regclass('protoolhub.welcome_email_keys') and a.attnum > 0 and not a.attisdropped
     and a.attname <> all (array['email_key', 'first_granted_on', 'created_at'])
  union all
  select 'a function can remove or change welcome_email_keys: ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and p.prosrc ~* '(delete\s+from|update|truncate)\s+protoolhub\.welcome_email_keys'
) checks;
