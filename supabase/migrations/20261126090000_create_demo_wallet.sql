-- Demo-only wallet for non-transferable, non-redeemable poker credits.
-- Xendit must remain in Test Mode. No cash-out or real-money game settlement.

create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_credits bigint not null default 0 check (balance_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_id text not null unique,
  xendit_session_id text unique,
  payment_id text unique,
  amount_php bigint not null check (amount_php in (50, 100, 250, 500)),
  credits bigint not null check (credits = amount_php * 100),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'failed')),
  checkout_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists wallet_topups_user_created_idx
  on public.wallet_topups (user_id, created_at desc);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topup_id uuid unique references public.wallet_topups (id) on delete restrict,
  reference_id text not null unique,
  payment_id text unique,
  transaction_type text not null
    check (transaction_type in ('topup', 'game_debit', 'game_credit', 'adjustment')),
  credits_delta bigint not null check (credits_delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.wallet_transactions enable row level security;

revoke all on public.wallets from anon, authenticated;
revoke all on public.wallet_topups from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;

grant select on public.wallets to authenticated;
grant select on public.wallet_topups to authenticated;
grant select on public.wallet_transactions to authenticated;

create policy "Players can read their own wallet"
  on public.wallets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can read their own top-ups"
  on public.wallet_topups for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can read their own wallet transactions"
  on public.wallet_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_wallet_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_wallet_after_auth_user_insert on auth.users;
create trigger create_wallet_after_auth_user_insert
  after insert on auth.users
  for each row execute function public.create_wallet_for_new_user();

-- Backfill accounts created before this migration (including anonymous Auth users).
insert into public.wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.set_wallet_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_wallet_updated_at on public.wallets;
create trigger set_wallet_updated_at
  before update on public.wallets
  for each row execute function public.set_wallet_updated_at();

-- Only trusted server code can call this RPC. The row lock + unique payment
-- identifiers make duplicate and concurrent webhook deliveries idempotent.
create or replace function public.complete_wallet_topup(
  p_topup_id uuid,
  p_payment_id text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topup public.wallet_topups%rowtype;
  v_balance bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_authorized';
  end if;

  if p_payment_id is null or length(trim(p_payment_id)) = 0 then
    raise exception 'payment_id_required';
  end if;

  select *
    into v_topup
    from public.wallet_topups
   where id = p_topup_id
   for update;

  if not found then
    raise exception 'topup_not_found';
  end if;

  select balance_credits
    into v_balance
    from public.wallets
   where user_id = v_topup.user_id
   for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if v_topup.status = 'completed' then
    return v_balance;
  end if;

  if v_topup.status not in ('pending', 'expired') then
    raise exception 'topup_not_payable';
  end if;

  update public.wallets
     set balance_credits = balance_credits + v_topup.credits
   where user_id = v_topup.user_id
   returning balance_credits into v_balance;

  insert into public.wallet_transactions (
    user_id,
    topup_id,
    reference_id,
    payment_id,
    transaction_type,
    credits_delta,
    balance_after,
    description
  ) values (
    v_topup.user_id,
    v_topup.id,
    'xendit-payment:' || p_payment_id,
    p_payment_id,
    'topup',
    v_topup.credits,
    v_balance,
    'Xendit sandbox wallet top-up'
  );

  update public.wallet_topups
     set status = 'completed',
         payment_id = p_payment_id,
         completed_at = now()
   where id = v_topup.id;

  return v_balance;
end;
$$;

revoke all on function public.complete_wallet_topup(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_wallet_topup(uuid, text) to service_role;
