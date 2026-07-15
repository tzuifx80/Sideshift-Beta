-- Phase 2 expands the existing locale field without changing the data model.
-- Applied migrations 0001-0013 remain immutable.

alter table public.profiles drop constraint if exists profiles_interface_language_check;
alter table public.profiles
  add constraint profiles_interface_language_check
  check (interface_language in ('en', 'de', 'fr', 'es', 'it'));

alter table public.debates drop constraint if exists debates_language_check;
alter table public.debates
  add constraint debates_language_check
  check (language in ('en', 'de', 'fr', 'es', 'it'));

alter table public.groups drop constraint if exists groups_language_check;
alter table public.groups
  add constraint groups_language_check
  check (language in ('en', 'de', 'fr', 'es', 'it'));

alter table public.group_topics drop constraint if exists group_topics_language_check;
alter table public.group_topics
  add constraint group_topics_language_check
  check (language in ('en', 'de', 'fr', 'es', 'it'));
