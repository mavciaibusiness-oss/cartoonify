-- Task 0022: ProToolHub accounts and the tool-agnostic credit wallet.
-- Everything lives in schema protoolhub. Nothing in public, leadgen or auth is
-- created, altered or granted. Browser-held keys (anon, authenticated) get no
-- access at all; the server calls four SECURITY DEFINER functions with the
-- service-role key, and those functions are the only way a balance changes.

create schema protoolhub;
revoke all on schema protoolhub from public;
grant usage on schema protoolhub to service_role;
alter default privileges in schema protoolhub revoke execute on functions from public;

-- What each tool costs, in credits. Other ProToolHub tools add a row here.
create table protoolhub.tool_costs (
  tool text primary key check (tool ~ '^[a-z][a-z0-9-]{1,39}$'),
  credits integer not null check (credits between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table protoolhub.tool_costs enable row level security;
insert into protoolhub.tool_costs (tool, credits) values ('cartoonify', 1);

-- The welcome offer and its abuse limits, one row, editable by the operator.
create table protoolhub.welcome_policy (
  id boolean primary key default true check (id),
  free_credits integer not null check (free_credits between 0 and 100),
  per_ip_per_day integer not null check (per_ip_per_day >= 0),
  per_device_per_day integer not null check (per_device_per_day >= 0),
  updated_at timestamptz not null default now()
);
alter table protoolhub.welcome_policy enable row level security;
insert into protoolhub.welcome_policy (free_credits, per_ip_per_day, per_device_per_day) values (2, 3, 1);

-- One row per person who has used a ProToolHub tool. The only reference to auth.users.
create table protoolhub.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_tool text not null references protoolhub.tool_costs (tool),
  created_at timestamptz not null default now()
);
alter table protoolhub.profiles enable row level security;

-- Two balances: free (watermarked output) and paid (spent first, no watermark).
create table protoolhub.wallets (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  free_credits integer not null default 0 check (free_credits >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0),
  updated_at timestamptz not null default now()
);
alter table protoolhub.wallets enable row level security;

-- One row per conversion attempt that reserved a credit. Never the image.
create table protoolhub.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  tool text not null references protoolhub.tool_costs (tool),
  style text not null check (char_length(style) between 1 and 80),
  credit_kind text not null check (credit_kind in ('free', 'paid')),
  credits integer not null check (credits > 0),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'refunded')),
  refund_reason text check (refund_reason is null or char_length(refund_reason) <= 40),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table protoolhub.conversions enable row level security;
create index conversions_user_status_idx on protoolhub.conversions (user_id, status, created_at);

-- Append-only record of every balance change. external_ref is for task 0023
-- (a payment provider's order id), unique so one purchase is credited once.
create table protoolhub.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  credit_kind text not null check (credit_kind in ('free', 'paid')),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('welcome', 'conversion', 'refund', 'purchase', 'adjustment')),
  conversion_id uuid references protoolhub.conversions (id) on delete set null,
  external_ref text unique,
  free_after integer not null check (free_after >= 0),
  paid_after integer not null check (paid_after >= 0),
  created_at timestamptz not null default now()
);
alter table protoolhub.credit_ledger enable row level security;
create index credit_ledger_user_idx on protoolhub.credit_ledger (user_id, created_at);

-- Who got the welcome credits, per account; deleted with the account. The IP
-- and device hashes are only needed for the daily caps and are blanked after
-- about two days.
create table protoolhub.welcome_grants (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  device_hash text check (device_hash ~ '^[0-9a-f]{64}$'),
  granted_on date not null,
  credits integer not null check (credits >= 0),
  created_at timestamptz not null default now()
);
alter table protoolhub.welcome_grants enable row level security;
create index welcome_grants_ip_idx on protoolhub.welcome_grants (granted_on, ip_hash);
create index welcome_grants_device_idx on protoolhub.welcome_grants (granted_on, device_hash);

-- Every e-mail address that ever received the welcome credits, as a SHA-256
-- hash of the normalised address (a+1@ and a+2@ count as one person). Kept for
-- life: it has no link to an account, so deleting the account leaves it, and
-- no function updates or deletes it. One welcome grant per address, ever.
create table protoolhub.welcome_email_keys (
  email_key text primary key check (email_key ~ '^[0-9a-f]{64}$'),
  first_granted_on date not null,
  created_at timestamptz not null default now()
);
alter table protoolhub.welcome_email_keys enable row level security;

-- Internal: create the profile and an empty wallet on first use.
create function protoolhub.ensure_account(p_user_id uuid, p_tool text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'protoolhub: unknown user' using errcode = 'P0002';
  end if;
  insert into protoolhub.profiles (user_id, first_tool) values (p_user_id, p_tool)
    on conflict (user_id) do nothing;
  insert into protoolhub.wallets (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
end;
$$;

-- Called by the server each time a signed-in user opens a tool. Idempotent.
-- Grants the welcome credits at most once per account and once per normalised
-- e-mail for life (welcome_email_keys outlives the account), only to a confirmed address, and only within the per-IP and
-- per-device daily caps. Refusals are not recorded, so a later visit can succeed.
create function protoolhub.claim_welcome(p_user_id uuid, p_tool text, p_ip_hash text, p_device_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_wallet protoolhub.wallets;
  v_policy protoolhub.welcome_policy;
  v_email text;
  v_confirmed timestamptz;
  v_local text;
  v_domain text;
  v_key text;
  v_outcome text;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'protoolhub: malformed hash' using errcode = '22023';
  end if;
  if not exists (select 1 from protoolhub.tool_costs t where t.tool = p_tool) then
    raise exception 'protoolhub: unknown tool' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, p_tool);
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id for update;

  if exists (select 1 from protoolhub.welcome_grants g where g.user_id = p_user_id) then
    v_outcome := 'already';
  else
    select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_user_id;
    if v_email is null or v_confirmed is null or position('@' in v_email) = 0 then
      v_outcome := 'email_unconfirmed';
    else
      v_local := split_part(lower(trim(v_email)), '@', 1);
      v_domain := split_part(lower(trim(v_email)), '@', 2);
      v_local := split_part(v_local, '+', 1);
      if v_domain in ('gmail.com', 'googlemail.com') then
        v_local := replace(v_local, '.', '');
        v_domain := 'gmail.com';
      end if;
      v_key := encode(sha256(convert_to(v_local || '@' || v_domain, 'UTF8')), 'hex');
      -- Serialise grants per address, per IP and per device so the rules hold under concurrency.
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.email.' || v_key, 0));
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.ip.' || p_ip_hash, 0));
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.device.' || p_device_hash, 0));
      select * into v_policy from protoolhub.welcome_policy p where p.id;
      if exists (select 1 from protoolhub.welcome_email_keys k where k.email_key = v_key) then
        v_outcome := 'email_used';
      elsif (select count(*) from protoolhub.welcome_grants g where g.granted_on = v_today and g.ip_hash = p_ip_hash) >= v_policy.per_ip_per_day then
        v_outcome := 'ip_cap';
      elsif (select count(*) from protoolhub.welcome_grants g where g.granted_on = v_today and g.device_hash = p_device_hash) >= v_policy.per_device_per_day then
        v_outcome := 'device_cap';
      else
        insert into protoolhub.welcome_email_keys (email_key, first_granted_on) values (v_key, v_today);
        insert into protoolhub.welcome_grants (user_id, ip_hash, device_hash, granted_on, credits)
          values (p_user_id, p_ip_hash, p_device_hash, v_today, v_policy.free_credits);
        if v_policy.free_credits > 0 then
          update protoolhub.wallets w
             set free_credits = w.free_credits + v_policy.free_credits, updated_at = now()
           where w.user_id = p_user_id
          returning * into v_wallet;
          insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, free_after, paid_after)
            values (p_user_id, 'free', v_policy.free_credits, 'welcome', v_wallet.free_credits, v_wallet.paid_credits);
        end if;
        v_outcome := 'granted';
      end if;
    end if;
  end if;

  -- The IP and device hashes are only needed for the daily caps.
  update protoolhub.welcome_grants g
     set ip_hash = null, device_hash = null
   where g.granted_on < v_today - 1 and (g.ip_hash is not null or g.device_hash is not null);

  return jsonb_build_object('outcome', v_outcome, 'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Give a reserved credit back. Idempotent: a conversion that is not 'reserved'
-- is left alone and reported with refunded = false.
create function protoolhub.refund_conversion(p_conversion_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv protoolhub.conversions;
  v_wallet protoolhub.wallets;
begin
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id;
  if not found then
    raise exception 'protoolhub: unknown conversion' using errcode = 'P0002';
  end if;
  -- Lock order everywhere: wallet first, then the conversion.
  select * into v_wallet from protoolhub.wallets w where w.user_id = v_conv.user_id for update;
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id for update;
  if v_conv.status <> 'reserved' then
    return jsonb_build_object('refunded', false, 'status', v_conv.status,
      'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
  end if;
  update protoolhub.conversions c
     set status = 'refunded', refund_reason = left(coalesce(nullif(p_reason, ''), 'unspecified'), 40), finished_at = now()
   where c.id = p_conversion_id;
  update protoolhub.wallets w
     set free_credits = w.free_credits + case when v_conv.credit_kind = 'free' then v_conv.credits else 0 end,
         paid_credits = w.paid_credits + case when v_conv.credit_kind = 'paid' then v_conv.credits else 0 end,
         updated_at = now()
   where w.user_id = v_conv.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, conversion_id, free_after, paid_after)
    values (v_conv.user_id, v_conv.credit_kind, v_conv.credits, 'refund', v_conv.id, v_wallet.free_credits, v_wallet.paid_credits);
  return jsonb_build_object('refunded', true, 'status', 'refunded',
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Reserve the cost of one conversion: paid credits first, free credits only
-- when the paid balance cannot cover it. Returns ok = false, and changes
-- nothing, when neither balance can.
create function protoolhub.begin_conversion(p_user_id uuid, p_tool text, p_style text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost integer;
  v_wallet protoolhub.wallets;
  v_kind text;
  v_id uuid;
  v_stale uuid;
begin
  select t.credits into v_cost from protoolhub.tool_costs t where t.tool = p_tool and t.active;
  if v_cost is null then
    raise exception 'protoolhub: unknown or inactive tool' using errcode = '22023';
  end if;
  if p_style is null or char_length(p_style) not between 1 and 80 then
    raise exception 'protoolhub: malformed style' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, p_tool);
  perform 1 from protoolhub.wallets w where w.user_id = p_user_id for update;

  -- A request that died between reserving and settling (a function timeout)
  -- leaves a reservation behind; give those back first.
  for v_stale in
    select c.id from protoolhub.conversions c
     where c.user_id = p_user_id and c.status = 'reserved' and c.created_at < now() - interval '10 minutes'
  loop
    perform protoolhub.refund_conversion(v_stale, 'expired');
  end loop;

  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  if v_wallet.paid_credits >= v_cost then
    v_kind := 'paid';
  elsif v_wallet.free_credits >= v_cost then
    v_kind := 'free';
  else
    return jsonb_build_object('ok', false, 'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
  end if;

  insert into protoolhub.conversions (user_id, tool, style, credit_kind, credits)
    values (p_user_id, p_tool, p_style, v_kind, v_cost)
  returning id into v_id;
  update protoolhub.wallets w
     set free_credits = w.free_credits - case when v_kind = 'free' then v_cost else 0 end,
         paid_credits = w.paid_credits - case when v_kind = 'paid' then v_cost else 0 end,
         updated_at = now()
   where w.user_id = p_user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, conversion_id, free_after, paid_after)
    values (p_user_id, v_kind, -v_cost, 'conversion', v_id, v_wallet.free_credits, v_wallet.paid_credits);
  return jsonb_build_object('ok', true, 'conversion_id', v_id, 'credit_kind', v_kind,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Mark a reserved conversion as delivered. Idempotent.
create function protoolhub.complete_conversion(p_conversion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv protoolhub.conversions;
begin
  update protoolhub.conversions c
     set status = 'succeeded', finished_at = now()
   where c.id = p_conversion_id and c.status = 'reserved'
  returning * into v_conv;
  if found then
    return jsonb_build_object('completed', true, 'status', 'succeeded');
  end if;
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id;
  if not found then
    raise exception 'protoolhub: unknown conversion' using errcode = 'P0002';
  end if;
  return jsonb_build_object('completed', false, 'status', v_conv.status);
end;
$$;

-- Browser-held keys get nothing. The service role gets the schema and the four
-- entry points, and no table privilege at all.
revoke all on all tables in schema protoolhub from public, anon, authenticated, service_role;
revoke all on all sequences in schema protoolhub from public, anon, authenticated, service_role;
revoke all on all functions in schema protoolhub from public, anon, authenticated, service_role;
grant execute on function protoolhub.claim_welcome(uuid, text, text, text) to service_role;
grant execute on function protoolhub.begin_conversion(uuid, text, text) to service_role;
grant execute on function protoolhub.complete_conversion(uuid) to service_role;
grant execute on function protoolhub.refund_conversion(uuid, text) to service_role;
