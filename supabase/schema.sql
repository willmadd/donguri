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

-- 15. New topic vocabulary: greetings, sports, actions, numbers, placements,
--     foods, hobbies (both courses) ---------------------------------------
-- Same idempotent shape as every section above. "Colours" already exists in
-- both courses so it's not repeated here. en-for-ja continues at position 5,
-- yue-for-en at position 3.

insert into public.lessons (course_id, path, title, position)
select id, 'vocab', l.title, l.position
from public.courses
cross join (values
  ('Greetings', 5),
  ('Sports', 6),
  ('Actions', 7),
  ('Numbers to 10', 8),
  ('Placements', 9),
  ('Foods', 10),
  ('Hobbies', 11)
) as l(title, position)
where public.courses.slug = 'en-for-ja'
on conflict (course_id, path, position) do nothing;

insert into public.lessons (course_id, path, title, position)
select id, 'vocab', l.title, l.position
from public.courses
cross join (values
  ('Greetings', 3),
  ('Sports', 4),
  ('Actions', 5),
  ('Numbers to 10', 6),
  ('Placements', 7),
  ('Foods', 8),
  ('Hobbies', 9)
) as l(title, position)
where public.courses.slug = 'yue-for-en'
on conflict (course_id, path, position) do nothing;

-- English for Japanese speakers -------------------------------------------

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('good morning', 'おはようございます', 'Good morning! Did you sleep well?', 1),
  ('good evening', 'こんばんは', 'Good evening, everyone.', 2),
  ('good night', 'おやすみなさい', 'Good night, see you tomorrow.', 3),
  ('see you later', 'またね', 'See you later, take care!', 4),
  ('see you tomorrow', 'また明日', 'See you tomorrow at school.', 5),
  ('how are you', 'お元気ですか', 'How are you today?', 6),
  ('I''m fine', '元気です', 'I''m fine, thank you for asking.', 7),
  ('nice to meet you', 'はじめまして', 'Nice to meet you, I''m Tom.', 8),
  ('long time no see', 'お久しぶりです', 'Long time no see! How have you been?', 9),
  ('welcome', 'ようこそ', 'Welcome to our home.', 10),
  ('have a good day', '良い一日を', 'Have a good day at work!', 11),
  ('take care', 'お大事に', 'Take care, and get well soon.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 5
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('soccer', 'サッカー', 'He plays soccer every weekend.', 1),
  ('baseball', '野球', 'Baseball is very popular in Japan.', 2),
  ('basketball', 'バスケットボール', 'She is good at basketball.', 3),
  ('tennis', 'テニス', 'We watched a tennis match.', 4),
  ('swimming', '水泳', 'Swimming is great exercise.', 5),
  ('running', 'ランニング', 'I go running every morning.', 6),
  ('volleyball', 'バレーボール', 'They played volleyball at the beach.', 7),
  ('golf', 'ゴルフ', 'My father enjoys golf.', 8),
  ('skiing', 'スキー', 'Skiing is fun in winter.', 9),
  ('table tennis', '卓球', 'Table tennis is fast and fun.', 10),
  ('badminton', 'バドミントン', 'Badminton is easy to learn.', 11),
  ('judo', '柔道', 'Judo is a traditional Japanese sport.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 6
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('eat', '食べる', 'I eat breakfast at seven.', 1),
  ('drink', '飲む', 'Please drink some water.', 2),
  ('run', '走る', 'He runs every morning.', 3),
  ('walk', '歩く', 'We walk to school together.', 4),
  ('sleep', '寝る', 'The baby is sleeping now.', 5),
  ('read', '読む', 'I like to read books.', 6),
  ('write', '書く', 'She writes in her diary.', 7),
  ('speak', '話す', 'Can you speak English?', 8),
  ('listen', '聞く', 'I listen to music every day.', 9),
  ('watch', '見る', 'Let''s watch a movie tonight.', 10),
  ('play', '遊ぶ', 'The kids play in the park.', 11),
  ('study', '勉強する', 'I study Japanese every night.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 7
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('one', '一', 'I have one brother.', 1),
  ('two', '二', 'She has two cats.', 2),
  ('three', '三', 'There are three books on the table.', 3),
  ('four', '四', 'He is four years old.', 4),
  ('five', '五', 'Five people are waiting.', 5),
  ('six', '六', 'I wake up at six.', 6),
  ('seven', '七', 'We have seven days in a week.', 7),
  ('eight', '八', 'The store closes at eight.', 8),
  ('nine', '九', 'Nine students are absent today.', 9),
  ('ten', '十', 'Ten fingers, ten toes.', 10)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 8
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('next to', '隣に', 'The bank is next to the station.', 1),
  ('left', '左', 'Turn left at the corner.', 2),
  ('right', '右', 'The store is on the right.', 3),
  ('above', '上に', 'The bird flew above the trees.', 4),
  ('below', '下に', 'The cat is below the table.', 5),
  ('in front of', '前に', 'She is standing in front of the door.', 6),
  ('behind', '後ろに', 'The garden is behind the house.', 7),
  ('inside', '中に', 'The keys are inside the bag.', 8),
  ('outside', '外に', 'Let''s eat outside today.', 9),
  ('between', '間に', 'The park is between two buildings.', 10),
  ('near', '近くに', 'The school is near my house.', 11),
  ('far', '遠くに', 'The airport is far from here.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 9
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('rice', 'ご飯', 'I eat rice every day.', 1),
  ('potato', 'じゃがいも', 'She boiled the potatoes.', 2),
  ('bread', 'パン', 'He bought fresh bread.', 3),
  ('meat', '肉', 'We don''t eat meat on Fridays.', 4),
  ('fish', '魚', 'The fish was delicious.', 5),
  ('vegetable', '野菜', 'Eat more vegetables.', 6),
  ('fruit', '果物', 'Fruit is good for you.', 7),
  ('egg', '卵', 'I had an egg for breakfast.', 8),
  ('milk', '牛乳', 'Please pass the milk.', 9),
  ('cheese', 'チーズ', 'I love cheese on pizza.', 10),
  ('noodles', '麺', 'Noodles are easy to cook.', 11),
  ('soup', 'スープ', 'The soup is still hot.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 10
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, example_sentence, position)
select l.id, w.term, w.translation, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('reading', '読書', 'Reading is my favorite hobby.', 1),
  ('cooking', '料理', 'Cooking relaxes me after work.', 2),
  ('drawing', '絵を描くこと', 'She enjoys drawing in her free time.', 3),
  ('photography', '写真撮影', 'Photography is a fun hobby.', 4),
  ('gardening', 'ガーデニング', 'Gardening keeps him busy on weekends.', 5),
  ('traveling', '旅行', 'Traveling opens your mind.', 6),
  ('singing', '歌うこと', 'Singing makes me happy.', 7),
  ('dancing', 'ダンス', 'Dancing is great exercise.', 8),
  ('fishing', '釣り', 'Fishing is peaceful.', 9),
  ('camping', 'キャンプ', 'We went camping last summer.', 10),
  ('gaming', 'ゲーム', 'Gaming is popular among teens.', 11),
  ('knitting', '編み物', 'Knitting is a relaxing hobby.', 12)
) as w(term, translation, example_sentence, position)
where c.slug = 'en-for-ja' and l.path = 'vocab' and l.position = 11
on conflict (lesson_id, position) do nothing;

-- Cantonese for English speakers -------------------------------------------

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('早晨', 'good morning', 'zou2 san4', '早晨，你瞓得好唔好？', 1),
  ('夜晚好', 'good evening', 'je6 maan5 hou2', '夜晚好，各位。', 2),
  ('晚安', 'good night', 'maan5 on1', '晚安，聽日見。', 3),
  ('遲啲見', 'see you later', 'ci4 di1 gin3', '遲啲見，你要保重呀。', 4),
  ('聽日見', 'see you tomorrow', 'ting1 jat6 gin3', '聽日見，返學要早啲。', 5),
  ('你好嗎', 'how are you', 'nei5 hou2 maa3', '你好嗎？今日點呀？', 6),
  ('我幾好', 'I''m fine', 'ngo5 gei2 hou2', '我幾好，多謝關心。', 7),
  ('好高興認識你', 'nice to meet you', 'hou2 gou1 hing3 jing6 sik1 nei5', '好高興認識你，我叫阿明。', 8),
  ('好耐冇見', 'long time no see', 'hou2 noi6 mou5 gin3', '好耐冇見，你最近點呀？', 9),
  ('歡迎', 'welcome', 'fun1 jing4', '歡迎嚟到我屋企。', 10),
  ('祝你今日愉快', 'have a good day', 'zuk1 nei5 gam1 jat6 jyu4 faai3', '返工順利，祝你今日愉快。', 11),
  ('保重', 'take care', 'bou2 zung6', '保重呀，早啲好返。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 3
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('足球', 'soccer', 'zuk1 kau4', '佢每個週末都踢足球。', 1),
  ('棒球', 'baseball', 'paang5 kau4', '棒球喺日本好受歡迎。', 2),
  ('籃球', 'basketball', 'laam4 kau4', '佢打籃球好叻。', 3),
  ('網球', 'tennis', 'mong5 kau4', '我哋睇咗場網球比賽。', 4),
  ('游水', 'swimming', 'jau4 seoi2', '游水係好好嘅運動。', 5),
  ('跑步', 'running', 'paau2 bou6', '我每朝都去跑步。', 6),
  ('排球', 'volleyball', 'paai4 kau4', '佢哋喺沙灘打排球。', 7),
  ('高爾夫球', 'golf', 'gou1 ji5 fu1 kau4', '我爸爸鍾意打高爾夫球。', 8),
  ('滑雪', 'skiing', 'waat6 syut3', '冬天滑雪好好玩。', 9),
  ('乒乓波', 'table tennis', 'bing1 bam1 bo1', '乒乓波又快又好玩。', 10),
  ('羽毛球', 'badminton', 'jyu5 mou4 kau4', '羽毛球好易學。', 11),
  ('柔道', 'judo', 'jau4 dou6', '柔道係日本傳統運動。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 4
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('食', 'eat', 'sik6', '我七點食早餐。', 1),
  ('飲', 'drink', 'jam2', '唔該飲啲水。', 2),
  ('跑', 'run', 'paau2', '佢每朝都跑步。', 3),
  ('行', 'walk', 'haang4', '我哋一齊行去學校。', 4),
  ('瞓覺', 'sleep', 'fan3 gaau3', 'BB而家瞓緊覺。', 5),
  ('睇書', 'read', 'tai2 syu1', '我鍾意睇書。', 6),
  ('寫', 'write', 'se2', '佢寫緊日記。', 7),
  ('講', 'speak', 'gong2', '你識唔識講英文？', 8),
  ('聽', 'listen', 'teng1', '我日日都聽歌。', 9),
  ('睇', 'watch', 'tai2', '今晚一齊睇戲呀。', 10),
  ('玩', 'play', 'waan2', '啲細路喺公園玩。', 11),
  ('讀書', 'study', 'duk6 syu1', '我夜晚都讀緊日文。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 5
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('一', 'one', 'jat1', '而家一點。', 1),
  ('二', 'two', 'ji6', '我住喺二樓。', 2),
  ('三', 'three', 'saam1', '而家三點。', 3),
  ('四', 'four', 'sei3', '佢四歲。', 4),
  ('五', 'five', 'ng5', '而家五點。', 5),
  ('六', 'six', 'luk6', '我六點起身。', 6),
  ('七', 'seven', 'cat1', '一個禮拜有七日。', 7),
  ('八', 'eight', 'baat3', '間鋪八點關門。', 8),
  ('九', 'nine', 'gau2', '九個學生冇嚟。', 9),
  ('十', 'ten', 'sap6', '十隻手指，十隻腳趾。', 10)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 6
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('隔籬', 'next to', 'gaak3 lei4', '銀行喺車站隔籬。', 1),
  ('左邊', 'left', 'zo2 bin1', '喺路口轉左。', 2),
  ('右邊', 'right', 'jau6 bin1', '間鋪喺右邊。', 3),
  ('上面', 'above', 'soeng6 min6', '隻雀喺樹上面飛。', 4),
  ('下面', 'below', 'haa6 min6', '隻貓喺枱下面。', 5),
  ('前面', 'in front of', 'cin4 min6', '佢企喺門前面。', 6),
  ('後面', 'behind', 'hau6 min6', '花園喺屋後面。', 7),
  ('入面', 'inside', 'jap6 min6', '鎖匙喺袋入面。', 8),
  ('出面', 'outside', 'ceot1 min6', '今日出面食飯啦。', 9),
  ('中間', 'between', 'zung1 gaan1', '公園喺兩座樓中間。', 10),
  ('附近', 'near', 'fu6 gan6', '學校喺我屋企附近。', 11),
  ('遠', 'far', 'jyun5', '機場離呢度好遠。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 7
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('飯', 'rice', 'faan6', '我日日都食飯。', 1),
  ('薯仔', 'potato', 'syu4 zai2', '佢煲咗啲薯仔。', 2),
  ('麵包', 'bread', 'min6 baau1', '佢買咗新鮮麵包。', 3),
  ('肉', 'meat', 'juk6', '我哋星期五唔食肉。', 4),
  ('魚', 'fish', 'jyu2', '條魚好好味。', 5),
  ('菜', 'vegetable', 'coi3', '多食啲菜啦。', 6),
  ('生果', 'fruit', 'saang1 gwo2', '生果對身體好。', 7),
  ('蛋', 'egg', 'daan2', '我食咗隻蛋做早餐。', 8),
  ('奶', 'milk', 'naai5', '唔該遞返樽奶畀我。', 9),
  ('芝士', 'cheese', 'zi1 si2', '我鍾意薄餅加芝士。', 10),
  ('麵', 'noodles', 'min6', '麵好易煮。', 11),
  ('湯', 'soup', 'tong1', '碗湯仲好熱。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 8
on conflict (lesson_id, position) do nothing;

insert into public.words (lesson_id, term, translation, romanization, example_sentence, position)
select l.id, w.term, w.translation, w.romanization, w.example_sentence, w.position
from public.lessons l
join public.courses c on c.id = l.course_id
cross join (values
  ('睇書', 'reading', 'tai2 syu1', '睇書係我最鍾意嘅興趣。', 1),
  ('煮飯', 'cooking', 'zyu2 faan6', '煮飯令我放鬆。', 2),
  ('畫畫', 'drawing', 'waak6 waa2', '佢得閒鍾意畫畫。', 3),
  ('攝影', 'photography', 'sip3 jing2', '攝影係好好玩嘅興趣。', 4),
  ('種花', 'gardening', 'zung3 faa1', '佢週末鍾意種花。', 5),
  ('旅行', 'traveling', 'leoi5 hang4', '旅行可以開闊眼界。', 6),
  ('唱歌', 'singing', 'coeng3 go1', '唱歌令我開心。', 7),
  ('跳舞', 'dancing', 'tiu3 mou5', '跳舞係好好嘅運動。', 8),
  ('釣魚', 'fishing', 'diu3 jyu2', '釣魚好寧靜。', 9),
  ('露營', 'camping', 'lou6 jing4', '我哋琴年夏天去露營。', 10),
  ('打機', 'gaming', 'daa2 gei1', '打機喺後生仔中間好流行。', 11),
  ('織冷衫', 'knitting', 'zik1 laang1 saam1', '織冷衫係好放鬆嘅興趣。', 12)
) as w(term, translation, romanization, example_sentence, position)
where c.slug = 'yue-for-en' and l.path = 'vocab' and l.position = 9
on conflict (lesson_id, position) do nothing;

-- 16. Word images (bunny.net) ------------------------------------------------
-- `image_key` is the object path within the `donguri` bunny.net storage zone
-- (e.g. `words/<uuid>.webp`), not a full URL — the CDN URL is built at read
-- time from BUNNY_PULL_ZONE_HOST. Null until an admin uploads a picture for
-- that word; `lib/images.ts` falls back to the legacy filename-convention
-- lookup when it's absent.

alter table public.words add column if not exists image_key text;

-- 17. Active/inactive toggle for courses and words --------------------------
-- Lets an admin hide a course or word from the learner-facing app without
-- deleting it. Defaults to true so every existing row stays visible.

alter table public.courses add column if not exists active boolean not null default true;
alter table public.words add column if not exists active boolean not null default true;

-- 18. Active/inactive toggle for categories (lessons) -----------------------
-- Same purpose as section 17, one level down: hides a whole category from
-- the learner-facing app without deleting it or its words.

alter table public.lessons add column if not exists active boolean not null default true;
