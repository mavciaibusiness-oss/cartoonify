-- Task 0026: one-time credit packs paid through Stripe, in provider-independent
-- tables. Everything lives in schema protoolhub. Nothing in public, leadgen or
-- auth is created, altered, granted or written; leadgen.org_members is only READ,
-- inside protoolhub.delete_account, exactly as 0024 does. The Polar tables and
-- functions of 0023/0024 are not altered. Paid credits are added only by
-- protoolhub.payment_checkout_paid, called by the signature-verified Stripe
-- webhook with the service-role key, once per checkout.

-- One row per checkout our server created for a signed-in user. Pack, credits,
-- price and currency are fixed here, server-side, when the checkout is created.
create table protoolhub.payment_checkouts (
  provider text not null check (provider in ('stripe')),
  checkout_ref text not null check (checkout_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  user_id uuid references protoolhub.profiles (user_id) on delete set null,
  environment text not null check (environment in ('sandbox', 'production')),
  pack text not null check (pack in ('p10', 'p30', 'p75')),
  credits integer not null,
  amount integer not null,
  currency text not null,
  status text not null default 'open' check (status in ('open', 'credited', 'refused')),
  refuse_reason text check (refuse_reason is null or char_length(refuse_reason) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, checkout_ref),
  constraint payment_checkouts_pack_price check (
    currency = 'usd' and (
      (pack = 'p10' and credits = 10 and amount = 399)
      or (pack = 'p30' and credits = 30 and amount = 999)
      or (pack = 'p75' and credits = 75 and amount = 1999)))
);
alter table protoolhub.payment_checkouts enable row level security;
create index payment_checkouts_user_idx on protoolhub.payment_checkouts (user_id, created_at);

-- One row per credited payment. payment_ref is the provider's payment id (Stripe:
-- the PaymentIntent), which refunds and disputes name. credit_ledger.external_ref
-- of the purchase is provider || ':' || checkout_ref.
create table protoolhub.payment_orders (
  provider text not null check (provider in ('stripe')),
  payment_ref text not null check (payment_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  checkout_ref text not null,
  user_id uuid references protoolhub.profiles (user_id) on delete set null,
  environment text not null check (environment in ('sandbox', 'production')),
  credits integer not null check (credits between 1 and 1000),
  amount_paid integer not null check (amount_paid > 0),
  amount_tax integer not null default 0 check (amount_tax >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  charge_amount integer check (charge_amount is null or charge_amount > 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  dispute_ref text check (dispute_ref is null or dispute_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  dispute_status text check (dispute_status is null or dispute_status ~ '^[a-z_]{1,40}$'),
  disputed_at timestamptz,
  deducted_credits integer not null default 0 check (deducted_credits >= 0),
  shortfall_credits integer not null default 0 check (shortfall_credits >= 0),
  alerted_shortfall integer not null default 0 check (alerted_shortfall >= 0),
  alerted_dispute_status text check (alerted_dispute_status is null or alerted_dispute_status ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, payment_ref),
  constraint payment_orders_one_per_checkout unique (provider, checkout_ref),
  constraint payment_orders_checkout_fkey foreign key (provider, checkout_ref)
    references protoolhub.payment_checkouts (provider, checkout_ref),
  constraint payment_orders_bounds check (
    deducted_credits + shortfall_credits <= credits
    and alerted_shortfall <= shortfall_credits
    and (charge_amount is null or refunded_amount <= charge_amount))
);
alter table protoolhub.payment_orders enable row level security;
create index payment_orders_user_idx on protoolhub.payment_orders (user_id, created_at);

-- Internal: bring a payment's deductions up to date. Owed back in total: the
-- whole pack once a dispute was opened, otherwise ceil(credits * refunded /
-- charge amount). Paid credits only, down to zero; the rest becomes shortfall.
-- Nothing is ever given back. A payment whose account was deleted is recorded only.
create function protoolhub.payment_reconcile(p_provider text, p_payment_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
  v_wallet protoolhub.wallets;
  v_target integer;
  v_owed integer;
  v_take integer := 0;
begin
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return jsonb_build_object('outcome', 'not_ours', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  if v_order.user_id is not null then
    select * into v_wallet from protoolhub.wallets w where w.user_id = v_order.user_id for update;
  end if;
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref for update;
  if v_order.disputed_at is not null then
    v_target := v_order.credits;
  elsif v_order.charge_amount is null or v_order.refunded_amount = 0 then
    v_target := 0;
  else
    v_target := ((v_order.credits::bigint * v_order.refunded_amount + v_order.charge_amount - 1)
                 / v_order.charge_amount)::integer;
  end if;
  v_owed := v_target - v_order.deducted_credits - v_order.shortfall_credits;
  if v_order.user_id is null then
    return jsonb_build_object('outcome', 'account_deleted',
      'deducted_credits', v_order.deducted_credits, 'shortfall_credits', v_order.shortfall_credits,
      'alert_shortfall', 0,
      'alert_dispute', case when v_order.dispute_status is distinct from v_order.alerted_dispute_status
                            then v_order.dispute_status end,
      'account_id', null, 'free_credits', 0, 'paid_credits', 0);
  end if;
  if v_owed > 0 then
    v_take := least(v_owed, v_wallet.paid_credits);
    if v_take > 0 then
      update protoolhub.wallets w
         set paid_credits = w.paid_credits - v_take, updated_at = now()
       where w.user_id = v_order.user_id
      returning * into v_wallet;
      insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
        values (v_order.user_id, 'paid', -v_take, 'adjustment',
                v_order.provider || ':' || v_order.checkout_ref || ':back:' || v_target,
                v_wallet.free_credits, v_wallet.paid_credits);
    end if;
    update protoolhub.payment_orders o
       set deducted_credits = o.deducted_credits + v_take,
           shortfall_credits = o.shortfall_credits + (v_owed - v_take),
           updated_at = now()
     where o.provider = p_provider and o.payment_ref = p_payment_ref
    returning * into v_order;
  end if;
  return jsonb_build_object('outcome', 'applied',
    'deducted_credits', v_order.deducted_credits, 'shortfall_credits', v_order.shortfall_credits,
    'alert_shortfall', v_order.shortfall_credits - v_order.alerted_shortfall,
    'alert_dispute', case when v_order.dispute_status is distinct from v_order.alerted_dispute_status
                          then v_order.dispute_status end,
    'account_id', v_order.user_id::text,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Called by the checkout route after the provider created the checkout. Idempotent.
create function protoolhub.payment_record_checkout(p_provider text, p_checkout_ref text, p_user_id uuid,
  p_environment text, p_pack text, p_credits integer, p_amount integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_ref is null or p_checkout_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed checkout ref' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, 'cartoonify');
  if p_environment = 'sandbox' and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = p_user_id) then
    return jsonb_build_object('outcome', 'sandbox_not_allowed');
  end if;
  insert into protoolhub.payment_checkouts (provider, checkout_ref, user_id, environment, pack, credits, amount, currency)
    values (p_provider, p_checkout_ref, p_user_id, p_environment, p_pack, p_credits, p_amount, p_currency)
    on conflict (provider, checkout_ref) do nothing;
  if not found then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'recorded');
end;
$$;

-- Called by the webhook for a paid checkout. Credits the checkout's pack once,
-- only when the checkout, environment, account and pack all match.
create function protoolhub.payment_checkout_paid(p_provider text, p_environment text, p_checkout_ref text,
  p_payment_ref text, p_user_ref text, p_pack text, p_amount_paid integer, p_amount_tax integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.payment_checkouts;
  v_wallet protoolhub.wallets;
  v_outcome text;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_ref is null or p_checkout_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed checkout ref' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  -- Serialise every delivery for one checkout, so concurrent retries credit once.
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.checkout.' || p_provider || '.' || p_checkout_ref, 0));
  if exists (select 1 from protoolhub.payment_orders o
              where o.provider = p_provider and o.checkout_ref = p_checkout_ref) then
    return jsonb_build_object('outcome', 'duplicate', 'credits', 0, 'deducted_credits', 0,
      'shortfall_credits', 0, 'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  select * into v_co from protoolhub.payment_checkouts c
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref;
  if not found then
    v_outcome := 'unknown_checkout';
  elsif v_co.user_id is null then
    v_outcome := 'account_deleted';
  elsif v_co.environment <> p_environment then
    v_outcome := 'environment_mismatch';
  elsif v_co.status <> 'open' then
    v_outcome := 'checkout_used';
  elsif p_user_ref is null or p_user_ref <> v_co.user_id::text then
    v_outcome := 'user_mismatch';
  elsif p_pack is null or p_pack <> v_co.pack then
    v_outcome := 'pack_mismatch';
  elsif p_amount_paid is null or p_amount_paid <= 0 then
    v_outcome := 'zero_amount';
  elsif p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    v_outcome := 'bad_currency';
  elsif v_co.environment = 'sandbox'
    and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = v_co.user_id) then
    v_outcome := 'sandbox_not_allowed';
  else
    v_outcome := 'credited';
  end if;

  if v_outcome <> 'credited' then
    if v_outcome not in ('unknown_checkout', 'environment_mismatch', 'checkout_used') then
      update protoolhub.payment_checkouts c
         set status = 'refused', refuse_reason = v_outcome, updated_at = now()
       where c.provider = p_provider and c.checkout_ref = p_checkout_ref and c.status = 'open';
    end if;
    return jsonb_build_object('outcome', v_outcome, 'credits', 0, 'deducted_credits', 0,
      'shortfall_credits', 0, 'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;

  select * into v_wallet from protoolhub.wallets w where w.user_id = v_co.user_id for update;
  insert into protoolhub.payment_orders (provider, payment_ref, checkout_ref, user_id, environment, credits,
    amount_paid, amount_tax, currency)
    values (p_provider, p_payment_ref, p_checkout_ref, v_co.user_id, v_co.environment, v_co.credits,
            p_amount_paid, greatest(coalesce(p_amount_tax, 0), 0), lower(p_currency));
  update protoolhub.wallets w
     set paid_credits = w.paid_credits + v_co.credits, updated_at = now()
   where w.user_id = v_co.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
    values (v_co.user_id, 'paid', v_co.credits, 'purchase', p_provider || ':' || p_checkout_ref,
            v_wallet.free_credits, v_wallet.paid_credits);
  update protoolhub.payment_checkouts c
     set status = 'credited', updated_at = now()
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref)
    || jsonb_build_object('outcome', 'credited', 'credits', v_co.credits);
end;
$$;

-- Called by the webhook for a refund. p_refunded_amount is the provider's
-- CUMULATIVE refunded amount of the charge (Stripe: charge.amount_refunded), so a
-- replay or an out-of-order delivery never deducts twice: the larger value wins.
create function protoolhub.payment_refund(p_provider text, p_environment text, p_payment_ref text,
  p_charge_amount integer, p_refunded_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  if p_charge_amount is null or p_charge_amount <= 0 or p_refunded_amount is null or p_refunded_amount < 0 then
    raise exception 'protoolhub: malformed refund' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.order.' || p_provider || '.' || p_payment_ref, 0));
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return protoolhub.payment_reconcile(p_provider, p_payment_ref);
  end if;
  if v_order.environment <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  update protoolhub.payment_orders o
     set charge_amount = coalesce(o.charge_amount, p_charge_amount),
         refunded_amount = least(coalesce(o.charge_amount, p_charge_amount),
                                 greatest(o.refunded_amount, p_refunded_amount)),
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref);
end;
$$;

-- Called by the webhook when a dispute is opened or closed. Opening one takes
-- the whole pack back (never below zero). Closing it, even in our favour, gives
-- nothing back: the operator is told and corrects by hand if needed.
create function protoolhub.payment_dispute(p_provider text, p_environment text, p_payment_ref text,
  p_dispute_ref text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  if p_dispute_ref is null or p_dispute_ref !~ '^[A-Za-z0-9_-]{1,255}$'
     or p_status is null or p_status !~ '^[a-z_]{1,40}$' then
    raise exception 'protoolhub: malformed dispute' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.order.' || p_provider || '.' || p_payment_ref, 0));
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return protoolhub.payment_reconcile(p_provider, p_payment_ref);
  end if;
  if v_order.environment <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  update protoolhub.payment_orders o
     set dispute_ref = coalesce(o.dispute_ref, p_dispute_ref),
         dispute_status = case
           when o.dispute_status in ('won', 'lost', 'warning_closed')
            and p_status not in ('won', 'lost', 'warning_closed') then o.dispute_status
           else p_status end,
         disputed_at = coalesce(o.disputed_at, now()),
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref);
end;
$$;

-- Called after the operator alert e-mail was accepted by Resend.
create function protoolhub.payment_mark_alerted(p_provider text, p_payment_ref text, p_shortfall integer,
  p_dispute_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  update protoolhub.payment_orders o
     set alerted_shortfall = greatest(o.alerted_shortfall, least(coalesce(p_shortfall, 0), o.shortfall_credits)),
         alerted_dispute_status = case when p_dispute_status is not null and p_dispute_status = o.dispute_status
                                       then p_dispute_status else o.alerted_dispute_status end,
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref
  returning * into v_order;
  if not found then
    raise exception 'protoolhub: unknown payment' using errcode = 'P0002';
  end if;
  return jsonb_build_object('alerted_shortfall', v_order.alerted_shortfall,
    'alerted_dispute_status', v_order.alerted_dispute_status);
end;
$$;

-- Called by the return page: the state of one of the caller's own checkouts.
create function protoolhub.payment_checkout_status(p_user_id uuid, p_provider text, p_checkout_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.payment_checkouts;
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  select * into v_co from protoolhub.payment_checkouts c
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref and c.user_id = p_user_id;
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

-- 0024's function with the payment tables anonymised as the Polar ones are.
create or replace function protoolhub.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member boolean;
  v_deleted boolean;
begin
  if p_user_id is null then
    raise exception 'protoolhub: unknown user' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.account.' || p_user_id::text, 0));
  -- Lock order everywhere: wallet first.
  perform 1 from protoolhub.wallets w where w.user_id = p_user_id for update;
  if exists (select 1 from protoolhub.conversions c
              where c.user_id = p_user_id and c.status = 'reserved'
                and c.created_at >= now() - interval '10 minutes') then
    return jsonb_build_object('outcome', 'busy', 'keep_auth_user', true);
  end if;
  select exists (select 1 from leadgen.org_members m where m.user_id = p_user_id) into v_member;
  update protoolhub.polar_checkouts c
     set status = 'refused', refuse_reason = 'account_deleted', updated_at = now()
   where c.user_id = p_user_id and c.status = 'open';
  update protoolhub.polar_orders o set user_id = null, updated_at = now() where o.user_id = p_user_id;
  update protoolhub.polar_checkouts c set user_id = null, updated_at = now() where c.user_id = p_user_id;
  update protoolhub.payment_checkouts c
     set status = 'refused', refuse_reason = 'account_deleted', updated_at = now()
   where c.user_id = p_user_id and c.status = 'open';
  update protoolhub.payment_orders o set user_id = null, updated_at = now() where o.user_id = p_user_id;
  update protoolhub.payment_checkouts c set user_id = null, updated_at = now() where c.user_id = p_user_id;
  delete from protoolhub.profiles p where p.user_id = p_user_id;
  v_deleted := found;
  return jsonb_build_object('outcome', case when v_deleted then 'deleted' else 'nothing' end,
    'keep_auth_user', v_member);
end;
$$;

-- 0024's function reading both the Polar orders and the payment orders.
create or replace function protoolhub.account_overview(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  return jsonb_build_object(
    'free_credits', coalesce(v_wallet.free_credits, 0),
    'paid_credits', coalesce(v_wallet.paid_credits, 0),
    'purchases', coalesce((
      select jsonb_agg(x.j order by x.t_at desc, x.k desc) from (
        select u.t_at, u.k, u.j from (
          select o.created_at t_at, 'polar:' || o.order_id k,
                 jsonb_build_object('at', o.created_at, 'pack', c.pack, 'credits', o.credits,
                   'refund', case when o.refunded_amount = 0 then 'none'
                                  when o.refunded_amount >= o.net_amount then 'full'
                                  else 'partial' end) j
            from protoolhub.polar_orders o
            join protoolhub.polar_checkouts c on c.checkout_id = o.checkout_id
           where o.user_id = p_user_id
          union all
          select o.created_at, o.provider || ':' || o.payment_ref,
                 jsonb_build_object('at', o.created_at, 'pack', c.pack, 'credits', o.credits,
                   'refund', case when o.refunded_amount = 0 then 'none'
                                  when o.charge_amount is not null and o.refunded_amount >= o.charge_amount then 'full'
                                  else 'partial' end)
            from protoolhub.payment_orders o
            join protoolhub.payment_checkouts c on c.provider = o.provider and c.checkout_ref = o.checkout_ref
           where o.user_id = p_user_id) u
         order by u.t_at desc, u.k desc
         limit 50) x), '[]'::jsonb),
    'conversions', coalesce((
      select jsonb_agg(x.j order by x.t_at desc, x.k desc) from (
        select v.created_at t_at, v.id::text k,
               jsonb_build_object('at', v.created_at, 'style', v.style, 'kind', v.credit_kind) j
          from protoolhub.conversions v
         where v.user_id = p_user_id and v.status = 'succeeded'
         order by v.created_at desc, v.id desc
         limit 50) x), '[]'::jsonb));
end;
$$;

-- Browser-held keys get nothing. The service role gets the six new entry points
-- and no table privilege. The two re-created functions keep 0024's privileges.
revoke all on table protoolhub.payment_checkouts, protoolhub.payment_orders
  from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_reconcile(text, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_record_checkout(text, text, uuid, text, text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_checkout_paid(text, text, text, text, text, text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_refund(text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_dispute(text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_mark_alerted(text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_checkout_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function protoolhub.payment_record_checkout(text, text, uuid, text, text, integer, integer, text) to service_role;
grant execute on function protoolhub.payment_checkout_paid(text, text, text, text, text, text, integer, integer, text) to service_role;
grant execute on function protoolhub.payment_refund(text, text, text, integer, integer) to service_role;
grant execute on function protoolhub.payment_dispute(text, text, text, text, text) to service_role;
grant execute on function protoolhub.payment_mark_alerted(text, text, integer, text) to service_role;
grant execute on function protoolhub.payment_checkout_status(uuid, text, text) to service_role;
