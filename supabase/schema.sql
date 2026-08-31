-- Donguri database schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.

-- 1. Profiles -----------------------------------------------------------
-- Public-facing user data, kept separate from `auth.users` (which Supabase
-- manages and you should not modify directly). One row per authenticated
-- user, created automatically on sign-up via the trigger below.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read and update their own profile. Nobody can change their own
-- role through this policy — role changes are restricted below.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A trigger (not the policy above) blocks a user from granting themselves
-- admin — see `prevent_role_self_update` below.

-- Admins can view every profile (e.g. for an admin user-management screen).
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 2. Auto-create a profile whenever a new user signs up ------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Keep `updated_at` current --------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4. Prevent users from promoting themselves to admin ---------------------
-- RLS lets a user update their own row (for name changes, etc.), so this
-- trigger silently blocks role changes made through the normal API. Role
-- changes made from the SQL editor (running as the postgres role) are
-- unaffected.

create or replace function public.prevent_role_self_update()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() = 'authenticated' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_self_update on public.profiles;
create trigger prevent_role_self_update
  before update on public.profiles
  for each row execute function public.prevent_role_self_update();

-- 5. Promote a user to admin ----------------------------------------------
-- New accounts always start as 'user' (see the trigger above) — there is no
-- public sign-up path to admin. Promote someone manually, after they've
-- signed up, by running:
--
--   update public.profiles set role = 'admin' where email = 'someone@example.com';

-- 6. Courses --------------------------------------------------------------
-- The top-level catalog: each course is one language pair (e.g. English for
-- Japanese speakers, Cantonese for English speakers). A user explicitly
-- enrolls in a course before its lessons/practice become reachable — see
-- `course_enrollments` below. Free for now; a paid tier can be added later
-- without restructuring, since enrollment is already its own table/action.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  target_language text not null,
  source_language text not null,
  description text,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "Authenticated users can view courses" on public.courses;
create policy "Authenticated users can view courses"
  on public.courses for select
  using (auth.role() = 'authenticated');

-- 7. Learning content: lessons and words -----------------------------------
-- Shared content, not user-owned, scoped to a course. `path` is 'vocab' or
-- 'grammar' — only 'vocab' has content so far. `term` is the word in the
-- language being learned, `translation` is its meaning in the learner's
-- base language, and `romanization` is an optional pronunciation aid (e.g.
-- Jyutping for Cantonese) — null for languages that don't need one.

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  path text not null check (path in ('vocab', 'grammar')),
  title text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (course_id, path, position)
);

alter table public.lessons enable row level security;

drop policy if exists "Authenticated users can view lessons" on public.lessons;
create policy "Authenticated users can view lessons"
  on public.lessons for select
  using (auth.role() = 'authenticated');

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  term text not null,
  translation text not null,
  romanization text,
  example_sentence text,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (lesson_id, position)
);

alter table public.words enable row level security;

drop policy if exists "Authenticated users can view words" on public.words;
create policy "Authenticated users can view words"
  on public.words for select
  using (auth.role() = 'authenticated');

-- 8. Per-user word progress (weighted spaced repetition) -------------------
-- One row per user per word, created the moment a word is first introduced.
-- `box` (1-5) is a mastery level, not a schedule: every not-yet-mastered word
-- is always eligible for review, but lower boxes (new words, or words just
-- answered wrong) are weighted to appear far more often than higher boxes
-- (answered correctly again and again) — see `weightForBox` in `lib/srs.ts`.
-- Wrong answers always reset a word to box 1; box 5 retires it as 'known'.

create table if not exists public.user_word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  status text not null default 'learning' check (status in ('learning', 'known')),
  box integer not null default 1 check (box between 1 and 5),
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  skipped boolean not null default false,
  introduced_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);

alter table public.user_word_progress enable row level security;

drop policy if exists "Users can view own word progress" on public.user_word_progress;
create policy "Users can view own word progress"
  on public.user_word_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own word progress" on public.user_word_progress;
create policy "Users can insert own word progress"
  on public.user_word_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own word progress" on public.user_word_progress;
create policy "Users can update own word progress"
  on public.user_word_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_word_progress_updated_at on public.user_word_progress;
create trigger set_user_word_progress_updated_at
  before update on public.user_word_progress
  for each row execute function public.set_updated_at();

-- 9. Course enrollments -----------------------------------------------------
-- "Signing up" for a course. A user can be enrolled in several at once;
-- each course's lessons/practice are only reachable once enrolled. Streaks
-- are tracked per enrollment, not per user — each course is its own
-- independent track, so "practiced today" means "practiced in this course."

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  unique (user_id, course_id)
);

alter table public.course_enrollments enable row level security;

drop policy if exists "Users can view own enrollments" on public.course_enrollments;
create policy "Users can view own enrollments"
  on public.course_enrollments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own enrollments" on public.course_enrollments;
create policy "Users can create own enrollments"
  on public.course_enrollments for insert
  with check (auth.uid() = user_id);

-- Safety net: enrollment didn't exist before courses did, so anyone who
-- already has practice progress is auto-enrolled in the course that
-- progress belongs to — a no-op on a fresh database, since no progress
-- rows exist yet.
insert into public.course_enrollments (user_id, course_id)
select distinct uwp.user_id, l.course_id
from public.user_word_progress uwp
join public.words w on w.id = uwp.word_id
join public.lessons l on l.id = w.lesson_id
on conflict (user_id, course_id) do nothing;

-- 10. Course catalog seed data ----------------------------------------------

insert into public.courses (slug, title, target_language, source_language, description, position) values
  ('en-for-ja', 'English for Japanese Speakers', 'en', 'ja', 'Build real English vocabulary and grammar, explained for Japanese speakers.', 1),
  ('yue-for-en', 'Cantonese for English Speakers', 'yue', 'en', 'Learn everyday Cantonese vocabulary and grammar, explained for English speakers.', 2)
on conflict (slug) do nothing;

-- 11. English vocabulary seed data ------------------------------------------
-- Idempotent: looked up by (course, path, position) / (lesson, position) so
-- this is safe to re-run and needs no hardcoded UUIDs.

insert into public.lessons (course_id, path, title, position)
select c.id, 'vocab', l.title, l.position
from public.courses c
cross join (values
  ('Everyday Basics', 1),
  ('Around Town', 2),
  ('Daily Life', 3)
) as l(title, position)
where c.slug = 'en-for-ja'
on conflict (course_id, path, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('hello', 'こんにちは', 'Hello, nice to meet you.', 1),
  ('thank you', 'ありがとう', 'Thank you so much for your help.', 2),
  ('please', 'お願いします', 'One coffee, please.', 3),
  ('yes', 'はい', 'Yes, that is correct.', 4),
  ('no', 'いいえ', 'No, thank you.', 5),
  ('sorry', 'すみません', 'Sorry, I am late.', 6),
  ('goodbye', 'さようなら', 'Goodbye, see you tomorrow.', 7),
  ('friend', '友達', 'She is my best friend.', 8),
  ('family', '家族', 'I am going to visit my family.', 9),
  ('name', '名前', 'What is your name?', 10)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 1
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('station', '駅', 'The station is near my house.', 1),
  ('restaurant', 'レストラン', 'Let''s eat at that restaurant.', 2),
  ('hospital', '病院', 'The hospital is open 24 hours.', 3),
  ('school', '学校', 'My children go to school by bus.', 4),
  ('store', 'お店', 'This store sells fresh vegetables.', 5),
  ('money', 'お金', 'I don''t have much money today.', 6),
  ('ticket', '切符', 'I bought a ticket for the train.', 7),
  ('bus', 'バス', 'The bus arrives every ten minutes.', 8),
  ('train', '電車', 'I take the train to work.', 9),
  ('taxi', 'タクシー', 'We took a taxi to the airport.', 10)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 2
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('morning', '朝', 'I drink coffee every morning.', 1),
  ('night', '夜', 'It gets dark early at night.', 2),
  ('water', '水', 'Can I have a glass of water?', 3),
  ('food', '食べ物', 'This food is delicious.', 4),
  ('work', '仕事', 'I have a lot of work today.', 5),
  ('home', '家', 'I want to go home now.', 6),
  ('book', '本', 'She is reading a new book.', 7),
  ('phone', '電話', 'My phone battery is low.', 8),
  ('weather', '天気', 'The weather is nice today.', 9),
  ('time', '時間', 'What time is it now?', 10)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 3
on conflict (lesson_id, position) do nothing;

-- 12. Cantonese seed data ---------------------------------------------------
-- A first lesson mirroring the English course's "Everyday Basics" concepts,
-- with Jyutping romanization. Matches "a few words" scope — one lesson, not
-- a full curriculum.

insert into public.lessons (course_id, path, title, position)
select id, 'vocab', 'Everyday Basics', 1
from public.courses
where slug = 'yue-for-en'
on conflict (course_id, path, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('你好', 'hello', 'nei5 hou2', '你好，你好嗎？', 1),
  ('多謝', 'thank you', 'do1 ze6', '多謝你嘅禮物。', 2),
  ('唔該', 'please / excuse me', 'm4 goi1', '唔該，一杯咖啡。', 3),
  ('係', 'yes', 'hai6', '係，啱嘅。', 4),
  ('唔係', 'no', 'm4 hai6', '唔係，唔該。', 5),
  ('對唔住', 'sorry', 'deoi3 m4 zyu6', '對唔住，我遲到咗。', 6),
  ('拜拜', 'goodbye', 'baai1 baai3', '拜拜，聽日見。', 7),
  ('朋友', 'friend', 'pang4 jau5', '佢係我嘅好朋友。', 8),
  ('家人', 'family', 'gaa1 jan4', '我今日去探我家人。', 9),
  ('名', 'name', 'meng2', '你叫咩名？', 10)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 1
on conflict (lesson_id, position) do nothing;

-- 13. Move streaks from profiles to course_enrollments, drop next_due_at ----
-- Streaks became per-course (see the note on `course_enrollments` above), and
-- `next_due_at` was replaced by weighted sampling (`weightForBox` in
-- `lib/srs.ts`) — every not-yet-mastered word is always eligible, so nothing
-- reads a due date anymore.

alter table public.course_enrollments add column if not exists current_streak integer not null default 0;
alter table public.course_enrollments add column if not exists longest_streak integer not null default 0;
alter table public.course_enrollments add column if not exists last_activity_date date;

-- Carry over any real streak a user already had before it moved per-course,
-- rather than silently resetting it to 0. Guarded so this stays safe to
-- re-run even after `profiles.current_streak` has already been dropped
-- below (a prior run of this same file).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_streak'
  ) then
    update public.course_enrollments ce
    set current_streak = p.current_streak,
        longest_streak = p.longest_streak,
        last_activity_date = p.last_activity_date
    from public.profiles p
    where p.id = ce.user_id
      and ce.current_streak = 0
      and ce.longest_streak = 0
      and ce.last_activity_date is null;
  end if;
end $$;

alter table public.profiles drop column if exists current_streak;
alter table public.profiles drop column if exists longest_streak;
alter table public.profiles drop column if exists last_activity_date;

alter table public.user_word_progress drop column if exists next_due_at;

-- 14. Colours seed data ------------------------------------------------------
-- A "Colours" lesson for each course, idempotent the same way as the other
-- seed sections (looked up by course/path/position, no hardcoded UUIDs).

insert into public.lessons (course_id, path, title, position)
select id, 'vocab', 'Colours', 4
from public.courses
where slug = 'en-for-ja'
on conflict (course_id, path, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('red', '赤', 'She is wearing a red dress.', 1),
  ('orange', 'オレンジ', 'I like the orange sunset.', 2),
  ('yellow', '黄色', 'The taxi is yellow.', 3),
  ('green', '緑', 'The park is full of green trees.', 4),
  ('blue', '青', 'The sky is blue today.', 5),
  ('purple', '紫', 'She painted the wall purple.', 6),
  ('pink', 'ピンク', 'The flowers are pink.', 7),
  ('black', '黒', 'He is wearing a black jacket.', 8),
  ('white', '白', 'The snow is pure white.', 9),
  ('brown', '茶色', 'The dog has brown fur.', 10)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 4
on conflict (lesson_id, position) do nothing;

insert into public.lessons (course_id, path, title, position)
select id, 'vocab', 'Colours', 2
from public.courses
where slug = 'yue-for-en'
on conflict (course_id, path, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('紅色', 'red', 'hung4 sik1', '佢着緊紅色嘅裙。', 1),
  ('橙色', 'orange', 'caang2 sik1', '我鍾意橙色嘅日落。', 2),
  ('黃色', 'yellow', 'wong4 sik1', '架的士係黃色嘅。', 3),
  ('綠色', 'green', 'luk6 sik1', '公園有好多綠色嘅樹。', 4),
  ('藍色', 'blue', 'laam4 sik1', '今日天空好藍。', 5),
  ('紫色', 'purple', 'zi2 sik1', '佢將幅牆油成紫色。', 6),
  ('粉紅色', 'pink', 'fan2 hung4 sik1', '啲花係粉紅色嘅。', 7),
  ('黑色', 'black', 'hak1 sik1', '佢着緊黑色嘅外套。', 8),
  ('白色', 'white', 'baak6 sik1', '啲雪好白。', 9),
  ('啡色', 'brown', 'fe1 sik1', '隻狗嘅毛係啡色嘅。', 10)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 2
on conflict (lesson_id, position) do nothing;
