-- Task 0023: Polar credit purchases on top of the 0022 wallet.
-- Everything lives in schema protoolhub. Nothing in public, leadgen or auth is
-- created, altered or granted, and no 0022 object is altered or replaced.
-- Paid credits are added only by protoolhub.polar_order_paid, called by the
-- signature-verified Polar webhook with the service-role key. One Polar order
-- is credited once; refunds are deducted proportionally, rounded up, down to
-- zero and never below it, and the part that could not be deducted is kept as
-- a shortfall for the operator.

-- One row per checkout our server created for a signed-in user. The pack and
-- its credits are fixed here, server-side, when the checkout is created.
create table protoolhub.polar_checkouts (
  checkout_id text primary key check (checkout_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  product_id text not null check (char_length(product_id) between 1 and 100),
  pack text not null check (pack in ('p10', 'p30', 'p75')),
  credits integer not null,
  status text not null default 'open' check (status in ('open', 'credited', 'refused')),
  refuse_reason text check (refuse_reason is null or char_length(refuse_reason) <= 40),
  order_id text check (order_id is null or order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polar_checkouts_pack_credits check (
    (pack = 'p10' and credits = 10) or (pack = 'p30' and credits = 30) or (pack = 'p75' and credits = 75))
);
alter table protoolhub.polar_checkouts enable row level security;
create index polar_checkouts_user_idx on protoolhub.polar_checkouts (user_id, created_at);

-- One row per credited Polar order. external_ref in credit_ledger is the order id.
create table protoolhub.polar_orders (
  order_id text primary key check (order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  checkout_id text not null unique references protoolhub.polar_checkouts (checkout_id) on delete cascade,
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  credits integer not null check (credits between 1 and 1000),
  net_amount integer not null check (net_amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  deducted_credits integer not null default 0 check (deducted_credits >= 0),
  shortfall_credits integer not null default 0 check (shortfall_credits >= 0),
  alerted_shortfall integer not null default 0 check (alerted_shortfall >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polar_orders_refund_bounds check (
    refunded_amount <= net_amount
    and deducted_credits + shortfall_credits <= credits
    and alerted_shortfall <= shortfall_credits)
);
alter table protoolhub.polar_orders enable row level security;
create index polar_orders_user_idx on protoolhub.polar_orders (user_id, created_at);

-- Refund signals, keyed so that a replayed webhook changes nothing: a Polar
-- refund id (refund.created / refund.updated), or 'order:<order id>' for the
-- order's cumulative refunded amount (order.refunded). No link to an account:
-- a refund can arrive before the order it belongs to. Amounts are net cents.
create table protoolhub.polar_refunds (
  refund_key text primary key check (refund_key ~ '^(order:)?[A-Za-z0-9_-]{1,100}$'),
  order_id text not null check (order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  environment text not null check (environment in ('sandbox', 'production')),
  amount integer not null check (amount >= 0),
  succeeded boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table protoolhub.polar_refunds enable row level security;
create index polar_refunds_order_idx on protoolhub.polar_refunds (order_id);

-- Accounts whose Polar SANDBOX purchases are credited. Preview and production
-- share this database, so a sandbox order credits real paid_credits; only the
-- accounts listed here can do that. Edited by the operator with SQL only.
create table protoolhub.sandbox_testers (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now()
);
alter table protoolhub.sandbox_testers enable row level security;

-- Internal: bring an order's deductions up to date with every refund signal
-- recorded for it. Deducts ceil(credits * refunded / net) in total, paid
-- credits only, down to zero; what cannot be deducted becomes shortfall.
create function protoolhub.polar_reconcile(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.polar_orders;
  v_wallet protoolhub.wallets;
  v_total integer;
  v_sum integer;
  v_refunded integer;
  v_target integer;
  v_owed integer;
  v_take integer;
begin
  select * into v_order from protoolhub.polar_orders o where o.order_id = p_order_id;
  if not found then
    return jsonb_build_object('outcome', 'order_unknown', 'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;
  -- Lock order everywhere: wallet first, then the order.
  select * into v_wallet from protoolhub.wallets w where w.user_id = v_order.user_id for update;
  select * into v_order from protoolhub.polar_orders o where o.order_id = p_order_id for update;
  select coalesce(max(r.amount) filter (where r.refund_key = 'order:' || p_order_id and r.succeeded), 0),
         coalesce(sum(r.amount) filter (where r.refund_key <> 'order:' || p_order_id and r.succeeded), 0)
    into v_total, v_sum
    from protoolhub.polar_refunds r
   where r.order_id = p_order_id and r.environment = v_order.environment;
  v_refunded := least(v_order.net_amount, greatest(v_total, v_sum, v_order.refunded_amount));
  v_target := ((v_order.credits::bigint * v_refunded + v_order.net_amount - 1) / v_order.net_amount)::integer;
  v_owed := v_target - v_order.deducted_credits - v_order.shortfall_credits;
  if v_owed > 0 then
    v_take := least(v_owed, v_wallet.paid_credits);
    if v_take > 0 then
      update protoolhub.wallets w
         set paid_credits = w.paid_credits - v_take, updated_at = now()
       where w.user_id = v_order.user_id
      returning * into v_wallet;
      insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
        values (v_order.user_id, 'paid', -v_take, 'adjustment', p_order_id || ':refund:' || v_target,
                v_wallet.free_credits, v_wallet.paid_credits);
    end if;
    update protoolhub.polar_orders o
       set refunded_amount = v_refunded,
           deducted_credits = o.deducted_credits + v_take,
           shortfall_credits = o.shortfall_credits + (v_owed - v_take),
           updated_at = now()
     where o.order_id = p_order_id
    returning * into v_order;
  elsif v_refunded > v_order.refunded_amount then
    update protoolhub.polar_orders o
       set refunded_amount = v_refunded, updated_at = now()
     where o.order_id = p_order_id
    returning * into v_order;
  end if;
  return jsonb_build_object('outcome', 'applied',
    'refunded_amount', v_order.refunded_amount,
    'deducted_credits', v_order.deducted_credits,
    'shortfall_credits', v_order.shortfall_credits,
    'alert_shortfall', v_order.shortfall_credits - v_order.alerted_shortfall,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Called by the checkout route after Polar created the checkout. Idempotent.
create function protoolhub.polar_record_checkout(p_checkout_id text, p_user_id uuid, p_environment text,
  p_product_id text, p_pack text, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_id is null or p_checkout_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed checkout id' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, 'cartoonify');
  if p_environment = 'sandbox' and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = p_user_id) then
    return jsonb_build_object('outcome', 'sandbox_not_allowed');
  end if;
  insert into protoolhub.polar_checkouts (checkout_id, user_id, environment, product_id, pack, credits)
    values (p_checkout_id, p_user_id, p_environment, p_product_id, p_pack, p_credits)
    on conflict (checkout_id) do nothing;
  if not found then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'recorded');
end;
$$;

-- Called by the webhook for order.paid. Credits the checkout's pack once per
-- order, only when the checkout, environment, customer and product all match.
create function protoolhub.polar_order_paid(p_environment text, p_order_id text, p_checkout_id text,
  p_customer_external_id text, p_product_id text, p_net_amount integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.polar_checkouts;
  v_wallet protoolhub.wallets;
  v_outcome text;
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed order id' using errcode = '22023';
  end if;
  -- Serialise every delivery of one order, so concurrent retries credit once.
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.order.' || p_order_id, 0));
  if exists (select 1 from protoolhub.polar_orders o where o.order_id = p_order_id) then
    return protoolhub.polar_reconcile(p_order_id) || jsonb_build_object('outcome', 'duplicate', 'credits', 0);
  end if;

  if p_checkout_id is null or p_checkout_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    v_outcome := 'unknown_checkout';
  else
    perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.checkout.' || p_checkout_id, 0));
    select * into v_co from protoolhub.polar_checkouts c where c.checkout_id = p_checkout_id;
    if not found then
      v_outcome := 'unknown_checkout';
    elsif v_co.environment <> p_environment then
      v_outcome := 'environment_mismatch';
    elsif v_co.status <> 'open' then
      v_outcome := 'checkout_used';
    elsif p_customer_external_id is null or p_customer_external_id <> v_co.user_id::text then
      v_outcome := 'user_mismatch';
    elsif p_product_id is null or p_product_id <> v_co.product_id then
      v_outcome := 'product_mismatch';
    elsif p_net_amount is null or p_net_amount <= 0 then
      v_outcome := 'zero_amount';
    elsif p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
      v_outcome := 'bad_currency';
    elsif v_co.environment = 'sandbox'
      and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = v_co.user_id) then
      v_outcome := 'sandbox_not_allowed';
    else
      v_outcome := 'credited';
    end if;
  end if;

  if v_outcome <> 'credited' then
    if v_outcome not in ('unknown_checkout', 'environment_mismatch', 'checkout_used') then
      update protoolhub.polar_checkouts c
         set status = 'refused', refuse_reason = v_outcome, order_id = p_order_id, updated_at = now()
       where c.checkout_id = v_co.checkout_id and c.status = 'open';
    end if;
    return jsonb_build_object('outcome', v_outcome, 'credits', 0,
      'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;

  select * into v_wallet from protoolhub.wallets w where w.user_id = v_co.user_id for update;
  insert into protoolhub.polar_orders (order_id, checkout_id, user_id, environment, credits, net_amount, currency)
    values (p_order_id, v_co.checkout_id, v_co.user_id, v_co.environment, v_co.credits, p_net_amount, lower(p_currency));
  update protoolhub.wallets w
     set paid_credits = w.paid_credits + v_co.credits, updated_at = now()
   where w.user_id = v_co.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
    values (v_co.user_id, 'paid', v_co.credits, 'purchase', p_order_id, v_wallet.free_credits, v_wallet.paid_credits);
  update protoolhub.polar_checkouts c
     set status = 'credited', order_id = p_order_id, updated_at = now()
   where c.checkout_id = v_co.checkout_id;
  -- A refund that arrived before this order is applied now.
  return protoolhub.polar_reconcile(p_order_id) || jsonb_build_object('outcome', 'credited', 'credits', v_co.credits);
end;
$$;

-- Called by the webhook for order.refunded (p_refund_key = 'order:' || order id,
-- p_amount = the order's cumulative refunded net amount) and for refund.created
-- and refund.updated (p_refund_key = the refund id, p_amount = its net amount).
-- Idempotent: the same signal twice deducts nothing more.
create function protoolhub.polar_refund(p_environment text, p_refund_key text, p_order_id text,
  p_amount integer, p_succeeded boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_env text;
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed order id' using errcode = '22023';
  end if;
  if p_refund_key is null or (p_refund_key <> 'order:' || p_order_id and p_refund_key !~ '^[A-Za-z0-9_-]{1,100}$') then
    raise exception 'protoolhub: malformed refund key' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 or p_succeeded is null then
    raise exception 'protoolhub: malformed refund' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.order.' || p_order_id, 0));
  select o.environment into v_env from protoolhub.polar_orders o where o.order_id = p_order_id;
  if found and v_env <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;
  insert into protoolhub.polar_refunds (refund_key, order_id, environment, amount, succeeded)
    values (p_refund_key, p_order_id, p_environment, p_amount, p_succeeded)
    on conflict (refund_key) do update
      set amount = greatest(protoolhub.polar_refunds.amount, excluded.amount),
          succeeded = protoolhub.polar_refunds.succeeded or excluded.succeeded,
          updated_at = now()
    where protoolhub.polar_refunds.order_id = excluded.order_id
      and protoolhub.polar_refunds.environment = excluded.environment;
  return protoolhub.polar_reconcile(p_order_id);
end;
$$;

-- Called after the operator alert e-mail for a shortfall was accepted by Resend.
create function protoolhub.polar_mark_alerted(p_order_id text, p_shortfall integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerted integer;
begin
  update protoolhub.polar_orders o
     set alerted_shortfall = greatest(o.alerted_shortfall, least(coalesce(p_shortfall, 0), o.shortfall_credits)),
         updated_at = now()
   where o.order_id = p_order_id
  returning o.alerted_shortfall into v_alerted;
  if not found then
    raise exception 'protoolhub: unknown order' using errcode = 'P0002';
  end if;
  return jsonb_build_object('alerted_shortfall', v_alerted);
end;
$$;

-- Called by the return page: the state of one of the caller's own checkouts.
create function protoolhub.polar_checkout_status(p_user_id uuid, p_checkout_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.polar_checkouts;
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  select * into v_co from protoolhub.polar_checkouts c where c.checkout_id = p_checkout_id and c.user_id = p_user_id;
  if not found then
    return jsonb_build_object('status', 'unknown', 'credits', 0,
      'free_credits', coalesce(v_wallet.free_credits, 0), 'paid_credits', coalesce(v_wallet.paid_credits, 0));
  end if;
  return jsonb_build_object(
    'status', case v_co.status when 'open' then 'pending' else v_co.status end,
    'credits', v_co.credits,
    'free_credits', coalesce(v_wallet.free_credits, 0), 'paid_credits', coalesce(v_wallet.paid_credits, 0));
end;
$$;

-- Browser-held keys get nothing. The service role gets the five new entry
-- points and no table privilege. Only this migration's objects are named, so
-- 0022's grants stay exactly as they are.
revoke all on table protoolhub.polar_checkouts, protoolhub.polar_orders, protoolhub.polar_refunds,
  protoolhub.sandbox_testers from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_reconcile(text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_record_checkout(text, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_refund(text, text, text, integer, boolean) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_mark_alerted(text, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_checkout_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function protoolhub.polar_record_checkout(text, uuid, text, text, text, integer) to service_role;
grant execute on function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) to service_role;
grant execute on function protoolhub.polar_refund(text, text, text, integer, boolean) to service_role;
grant execute on function protoolhub.polar_mark_alerted(text, integer) to service_role;
grant execute on function protoolhub.polar_checkout_status(uuid, text) to service_role;
