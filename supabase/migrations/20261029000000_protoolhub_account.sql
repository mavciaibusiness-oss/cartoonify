-- Task 0024: account deletion, the profile overview, and anonymised Polar records.
-- Everything lives in schema protoolhub. Nothing in public, leadgen or auth is
-- created, altered, granted or written; leadgen.org_members is only READ, inside
-- protoolhub.delete_account, to keep the sign-in of a Firma Bulucu member.
-- welcome_email_keys is never touched: the Q6 hash outlives every account.

-- Polar records outlive the account without a link to it (operator answer 2):
-- the 0023 foreign keys cascaded, which would have deleted the orders.
alter table protoolhub.polar_checkouts alter column user_id drop not null;
alter table protoolhub.polar_checkouts drop constraint polar_checkouts_user_id_fkey;
alter table protoolhub.polar_checkouts add constraint polar_checkouts_user_id_fkey
  foreign key (user_id) references protoolhub.profiles (user_id) on delete set null;
alter table protoolhub.polar_orders alter column user_id drop not null;
alter table protoolhub.polar_orders drop constraint polar_orders_user_id_fkey;
alter table protoolhub.polar_orders add constraint polar_orders_user_id_fkey
  foreign key (user_id) references protoolhub.profiles (user_id) on delete set null;

-- 0023's function with one guard: a refund on an anonymised order is recorded only.
create or replace function protoolhub.polar_reconcile(p_order_id text)
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
  -- 0024 guard start
  -- The account was deleted: the refund is recorded on the anonymised order;
  -- there is no wallet to deduct from and nothing becomes a shortfall.
  if v_order.user_id is null then
    if v_refunded > v_order.refunded_amount then
      update protoolhub.polar_orders o
         set refunded_amount = v_refunded, updated_at = now()
       where o.order_id = p_order_id
      returning * into v_order;
    end if;
    return jsonb_build_object('outcome', 'account_deleted',
      'refunded_amount', v_order.refunded_amount,
      'deducted_credits', v_order.deducted_credits,
      'shortfall_credits', v_order.shortfall_credits,
      'alert_shortfall', v_order.shortfall_credits - v_order.alerted_shortfall,
      'free_credits', 0, 'paid_credits', 0);
  end if;
  -- 0024 guard end
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
-- 0023's function with one guard: an anonymised checkout is never credited.
create or replace function protoolhub.polar_order_paid(p_environment text, p_order_id text, p_checkout_id text,
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
    -- 0024 guard start
    -- The account was deleted (anonymised checkout): never credit nobody.
    elsif v_co.user_id is null then
      v_outcome := 'account_deleted';
    -- 0024 guard end
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
-- Deletes one account's protoolhub records in one transaction. Refuses while a
-- conversion is running. Anonymises the Polar records first, then deletes the
-- profile (wallet, conversions, ledger, welcome grant and tester row cascade).
-- Answers whether the auth user must stay (a Firma Bulucu member).
create function protoolhub.delete_account(p_user_id uuid)
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
  delete from protoolhub.profiles p where p.user_id = p_user_id;
  v_deleted := found;
  return jsonb_build_object('outcome', case when v_deleted then 'deleted' else 'nothing' end,
    'keep_auth_user', v_member);
end;
$$;

-- The profile page: balances, the last 50 purchases and the last 50 delivered
-- conversions. Read only; never creates a profile. No order id, no amount, no image.
create function protoolhub.account_overview(p_user_id uuid)
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
        select o.created_at t_at, o.order_id k,
               jsonb_build_object('at', o.created_at, 'pack', c.pack, 'credits', o.credits,
                 'refund', case when o.refunded_amount = 0 then 'none'
                                when o.refunded_amount >= o.net_amount then 'full'
                                else 'partial' end) j
          from protoolhub.polar_orders o
          join protoolhub.polar_checkouts c on c.checkout_id = o.checkout_id
         where o.user_id = p_user_id
         order by o.created_at desc, o.order_id desc
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

-- Browser-held keys get nothing; the service role gets the two new entry points.
-- The two re-created functions keep the privileges 0023 gave them.
revoke all on function protoolhub.delete_account(uuid) from public, anon, authenticated, service_role;
revoke all on function protoolhub.account_overview(uuid) from public, anon, authenticated, service_role;
grant execute on function protoolhub.delete_account(uuid) to service_role;
grant execute on function protoolhub.account_overview(uuid) to service_role;
