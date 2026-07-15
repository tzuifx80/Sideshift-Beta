-- Client-side Puter AI preferences and owner-scoped quality feedback.
alter table public.user_preferences
  add column if not exists preferred_opponent_id text not null default 'gpt-logician',
  add column if not exists ai_difficulty text not null default 'intermediate',
  add column if not exists ai_round_length text not null default 'standard';

alter table public.user_preferences
  drop constraint if exists user_preferences_ai_difficulty,
  add constraint user_preferences_ai_difficulty check (ai_difficulty in ('beginner', 'intermediate', 'advanced', 'expert')),
  drop constraint if exists user_preferences_ai_round_length,
  add constraint user_preferences_ai_round_length check (ai_round_length in ('quick', 'standard', 'deep'));

create table if not exists public.ai_quality_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  debate_id uuid not null references public.debates(id) on delete cascade,
  opponent_id text not null check (char_length(opponent_id) between 1 and 60),
  model_id text not null check (char_length(model_id) between 1 and 160),
  feedback_type text not null check (feedback_type in ('helpful', 'not_helpful', 'incorrect', 'too_long', 'missed_point')),
  created_at timestamptz not null default now(),
  unique (owner_id, debate_id, opponent_id, feedback_type)
);

alter table public.ai_quality_feedback enable row level security;
create policy "ai_feedback_select_own" on public.ai_quality_feedback for select using (auth.uid() = owner_id);
create policy "ai_feedback_insert_own" on public.ai_quality_feedback for insert with check (auth.uid() = owner_id);
revoke update, delete on table public.ai_quality_feedback from anon, authenticated;
grant select, insert on table public.ai_quality_feedback to authenticated;
