-- Blood test tables

create table public.blood_tests (
  id bigserial primary key,
  file_name text not null,
  content_hash text,
  test_date text,
  lab_name text,
  patient_name text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index blood_tests_content_hash_uniq
  on public.blood_tests (content_hash)
  where content_hash is not null;

create table public.blood_test_results (
  id bigserial primary key,
  blood_test_id bigint not null references public.blood_tests (id) on delete cascade,
  marker_name text not null,
  value double precision,
  unit text,
  reference_range_low double precision,
  reference_range_high double precision,
  status text,
  raw_text text
);

create index blood_test_results_blood_test_id_idx
  on public.blood_test_results (blood_test_id);

create index blood_test_results_marker_name_idx
  on public.blood_test_results (marker_name);

-- Chat tables

create table public.chat_conversations (
  id bigserial primary key,
  title text not null,
  blood_test_id bigint references public.blood_tests (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id bigserial primary key,
  conversation_id bigint not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_id_idx
  on public.chat_messages (conversation_id);

-- RLS: enabled with permissive anon policies while there is no auth.
-- When auth is added, replace these policies with ones scoped to auth.uid().
alter table public.blood_tests enable row level security;
alter table public.blood_test_results enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy "anon all" on public.blood_tests for all to anon using (true) with check (true);
create policy "anon all" on public.blood_test_results for all to anon using (true) with check (true);
create policy "anon all" on public.chat_conversations for all to anon using (true) with check (true);
create policy "anon all" on public.chat_messages for all to anon using (true) with check (true);

-- Storage bucket for uploaded PDFs
insert into storage.buckets (id, name, public)
values ('blood-tests', 'blood-tests', false)
on conflict (id) do nothing;

create policy "anon read blood-tests"
  on storage.objects for select to anon
  using (bucket_id = 'blood-tests');

create policy "anon write blood-tests"
  on storage.objects for insert to anon
  with check (bucket_id = 'blood-tests');

create policy "anon delete blood-tests"
  on storage.objects for delete to anon
  using (bucket_id = 'blood-tests');

-- RPC: distinct marker names with usage counts, for the picker dropdown
create or replace function public.marker_list()
returns table (marker_name text, usage_count int)
language sql stable security invoker
as $$
  select marker_name, count(*)::int as usage_count
  from public.blood_test_results
  group by marker_name
  order by usage_count desc, marker_name asc;
$$;

-- RPC: summary stats for the dashboard
create or replace function public.blood_test_summary()
returns table (
  total_tests int,
  total_markers int,
  abnormal_count int,
  latest_test_date text
)
language sql stable security invoker
as $$
  select
    (select count(*)::int from public.blood_tests) as total_tests,
    (select count(*)::int from public.blood_test_results) as total_markers,
    (select count(*)::int
       from public.blood_test_results
       where status in ('high', 'low', 'critical')) as abnormal_count,
    (select test_date
       from public.blood_tests
       order by created_at desc
       limit 1) as latest_test_date;
$$;
