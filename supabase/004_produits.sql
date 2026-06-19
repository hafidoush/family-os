create table if not exists public.produits (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

alter table public.produits enable row level security;

create policy "Users manage own produits"
  on public.produits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
