-- =============================================================================
-- Auth + per-user data isolation
-- Replaces the permissive "anon all" policies with ones scoped to auth.uid().
-- =============================================================================

-- Drop old anon-all policies
drop policy if exists "anon all" on public.blood_tests;
drop policy if exists "anon all" on public.blood_test_results;
drop policy if exists "anon all" on public.chat_conversations;
drop policy if exists "anon all" on public.chat_messages;

drop policy if exists "anon read blood-tests" on storage.objects;
drop policy if exists "anon write blood-tests" on storage.objects;
drop policy if exists "anon delete blood-tests" on storage.objects;

-- -----------------------------------------------------------------------------
-- profiles: extends auth.users with user-facing metadata
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user sees own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: user updates own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Per-user ownership on domain tables.
--
-- DESTRUCTIVE: wipes existing rows -- they had no owner. Safe because this
-- app has never had real users; run `supabase db reset` to replay.
-- -----------------------------------------------------------------------------

truncate table public.chat_messages, public.chat_conversations,
              public.blood_test_results, public.blood_tests
  restart identity cascade;

alter table public.blood_tests
  add column user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade;

create index blood_tests_user_id_idx on public.blood_tests (user_id);

alter table public.chat_conversations
  add column user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade;

create index chat_conversations_user_id_idx on public.chat_conversations (user_id);

-- New RLS policies (authenticated role only)

create policy "blood_tests: owner select"
  on public.blood_tests for select
  to authenticated
  using (user_id = auth.uid());

create policy "blood_tests: owner insert"
  on public.blood_tests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "blood_tests: owner update"
  on public.blood_tests for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "blood_tests: owner delete"
  on public.blood_tests for delete
  to authenticated
  using (user_id = auth.uid());

-- results inherit ownership via FK to blood_tests
create policy "blood_test_results: owner select"
  on public.blood_test_results for select
  to authenticated
  using (
    exists (
      select 1 from public.blood_tests
      where blood_tests.id = blood_test_results.blood_test_id
        and blood_tests.user_id = auth.uid()
    )
  );

create policy "blood_test_results: owner insert"
  on public.blood_test_results for insert
  to authenticated
  with check (
    exists (
      select 1 from public.blood_tests
      where blood_tests.id = blood_test_results.blood_test_id
        and blood_tests.user_id = auth.uid()
    )
  );

create policy "blood_test_results: owner delete"
  on public.blood_test_results for delete
  to authenticated
  using (
    exists (
      select 1 from public.blood_tests
      where blood_tests.id = blood_test_results.blood_test_id
        and blood_tests.user_id = auth.uid()
    )
  );

create policy "chat_conversations: owner select"
  on public.chat_conversations for select
  to authenticated
  using (user_id = auth.uid());

create policy "chat_conversations: owner insert"
  on public.chat_conversations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "chat_conversations: owner update"
  on public.chat_conversations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "chat_conversations: owner delete"
  on public.chat_conversations for delete
  to authenticated
  using (user_id = auth.uid());

-- messages inherit ownership via FK to chat_conversations
create policy "chat_messages: owner select"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.user_id = auth.uid()
    )
  );

create policy "chat_messages: owner insert"
  on public.chat_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Dedup uniqueness is now per-user (same PDF can legitimately exist across
-- different users' accounts).
-- -----------------------------------------------------------------------------

drop index if exists blood_tests_content_hash_uniq;

create unique index blood_tests_user_content_hash_uniq
  on public.blood_tests (user_id, content_hash)
  where content_hash is not null;

-- -----------------------------------------------------------------------------
-- Storage policies: user can only touch files under their own uid prefix.
-- Edge functions upload to `{user_id}/{hash}.pdf`.
-- -----------------------------------------------------------------------------

create policy "blood-tests: user reads own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blood-tests: user writes own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blood-tests: user deletes own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'blood-tests'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
