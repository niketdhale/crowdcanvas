-- CrowdCanvas migration: moderation, reports, upload rate limit. Idempotent; run in Supabase SQL Editor.
--
-- MAKE YOURSELF ADMIN: Supabase Dashboard -> Authentication -> Users -> Add user (email + password),
-- copy that user's UUID, then run:   insert into public.admins values ('<uuid>');
-- Sign in at https://<your-site>/#admin

-- ---------- moderation ----------
-- Existing rows get 'approved' from the add-column default; new rows default to 'pending'. Safe to re-run.
alter table public.posters
  add column if not exists status text not null default 'approved' check (status in ('pending','approved','hidden'));
alter table public.posters alter column status set default 'pending';

create table if not exists public.admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.admins enable row level security; -- no policies: invisible to anon/authenticated

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from admins where user_id = auth.uid())
$$;

-- Drop ALL existing policies on posters (names unknown), then recreate.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'posters' loop
    execute format('drop policy %I on public.posters', r.policyname);
  end loop;
end $$;

alter table public.posters enable row level security;

create policy posters_select on public.posters for select to anon, authenticated
  using (status = 'approved' or public.is_admin());
create policy posters_insert on public.posters for insert to anon, authenticated
  with check (status = 'pending');
create policy posters_update on public.posters for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy posters_delete on public.posters for delete to authenticated
  using (public.is_admin());

-- Admins may delete images from the bucket (existing upload policy is left alone).
drop policy if exists posters_admin_delete_objects on storage.objects;
create policy posters_admin_delete_objects on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and public.is_admin());

-- Client IP as seen by Supabase's edge. The first X-Forwarded-For entry can be spoofed by the client, so
-- prefer cf-connecting-ip and fall back to the LAST X-Forwarded-For entry (added by the proxy).
-- ponytail: IP-based limits are best effort (shared NATs, VPNs); add captcha/auth if abuse persists.
create or replace function public.client_ip() returns text language sql stable as $$
  select nullif(trim(coalesce(
    h->>'cf-connecting-ip',
    (string_to_array(h->>'x-forwarded-for', ','))[array_length(string_to_array(h->>'x-forwarded-for', ','), 1)]
  )), '')
  from (select nullif(current_setting('request.headers', true), '')::json as h) x
$$;

-- ---------- reports ----------
alter table public.posters add column if not exists report_count int not null default 0;

-- posters.id type is unknown (uuid or bigint), so read it and build the table with format().
do $$
declare t text;
begin
  select format_type(atttypid, atttypmod) into t
    from pg_attribute where attrelid = 'public.posters'::regclass and attname = 'id';
  execute format($f$
    create table if not exists public.poster_reports (
      id bigint generated always as identity primary key,
      poster_id %s not null references public.posters(id) on delete cascade,
      reason text check (char_length(reason) <= 200),
      reporter_ip text,
      created_at timestamptz default now(),
      unique (poster_id, reporter_ip)
    )$f$, t);
end $$;

alter table public.poster_reports enable row level security;
drop policy if exists reports_insert on public.poster_reports;
drop policy if exists reports_select on public.poster_reports;
create policy reports_insert on public.poster_reports for insert to anon, authenticated with check (true);
create policy reports_select on public.poster_reports for select to authenticated using (public.is_admin());
grant insert on public.poster_reports to anon, authenticated;
grant select on public.poster_reports to authenticated;

create or replace function public.on_poster_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update posters
     set report_count = report_count + 1,
         status = case when report_count + 1 >= 3 and status = 'approved' then 'hidden' else status end
   where id = new.poster_id;
  return new;
end $$;

create or replace function public.on_poster_report_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.reporter_ip := public.client_ip(); return new; end $$;

drop trigger if exists poster_reports_before_insert on public.poster_reports;
create trigger poster_reports_before_insert before insert on public.poster_reports
  for each row execute function public.on_poster_report_before();

drop trigger if exists poster_reports_after_insert on public.poster_reports;
create trigger poster_reports_after_insert after insert on public.poster_reports
  for each row execute function public.on_poster_report();

-- ---------- upload rate limit (5 per IP per hour) ----------
create table if not exists public.upload_log (ip text not null, created_at timestamptz not null default now());
create index if not exists upload_log_ip_created_idx on public.upload_log (ip, created_at);
alter table public.upload_log enable row level security; -- no policies; only the trigger writes

create or replace function public.on_poster_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare client text;
begin
  -- never trust client-supplied counters
  new.report_count := 0;
  client := public.client_ip();
  if client is not null then
    delete from upload_log where created_at < now() - interval '1 day';
    if (select count(*) from upload_log where ip = client and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Upload limit reached, try again later';
    end if;
    insert into upload_log (ip) values (client);
  end if;
  return new;
end $$;

drop trigger if exists posters_before_insert on public.posters;
create trigger posters_before_insert before insert on public.posters
  for each row execute function public.on_poster_before_insert();
