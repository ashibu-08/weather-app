-- Run once in Supabase SQL Editor, or use supabase db push.
create table if not exists public.workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint workspace_size check (octet_length(data::text) <= 2000000)
);
alter table public.workspaces enable row level security;
create policy "Read own workspace" on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workspace" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.workspaces to authenticated;
revoke all on public.workspaces from anon;

-- Rate limits are updated atomically, including concurrent function requests.
create table public.ai_usage (user_id uuid references auth.users(id) on delete cascade, day date not null, calls integer not null default 0, primary key (user_id, day));
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
create or replace function public.claim_ai_request() returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into public.ai_usage (user_id,day,calls) values (auth.uid(),current_date,1)
 on conflict (user_id,day) do update set calls=ai_usage.calls+1 where ai_usage.calls<20
 returning calls into n;
 return n is not null;
end; $$;
revoke all on function public.claim_ai_request() from public, anon;
grant execute on function public.claim_ai_request() to authenticated;
