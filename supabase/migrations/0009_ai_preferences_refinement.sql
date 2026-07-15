-- Private-beta AI defaults. Existing rows receive conservative, cost-aware defaults.
alter table public.user_preferences
  add column if not exists preferred_opponent_type text not null default 'ask',
  add column if not exists preferred_ai_family text not null default 'GPT',
  add column if not exists preferred_ai_model_id text,
  add column if not exists ai_quality text not null default 'balanced',
  add column if not exists ai_response_length text not null default 'standard',
  add column if not exists show_model_details boolean not null default false;

alter table public.user_preferences
  drop constraint if exists user_preferences_preferred_opponent_type,
  add constraint user_preferences_preferred_opponent_type check (preferred_opponent_type in ('ask', 'ai', 'person')),
  drop constraint if exists user_preferences_preferred_ai_family,
  add constraint user_preferences_preferred_ai_family check (preferred_ai_family in ('Gemini', 'Claude', 'GPT', 'DeepSeek')),
  drop constraint if exists user_preferences_ai_quality,
  add constraint user_preferences_ai_quality check (ai_quality in ('fast', 'balanced', 'maximum')),
  drop constraint if exists user_preferences_ai_response_length,
  add constraint user_preferences_ai_response_length check (ai_response_length in ('concise', 'standard', 'detailed'));
