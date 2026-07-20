-- Include reviewed translation languages in the minimal editor payload without
-- exposing review notes or private actors to the client.

create or replace function public.get_world_pulse_editor_items()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'slug', i.slug, 'status', i.status, 'headline', i.headline,
    'debateStatement', i.debate_statement, 'neutralContext', i.neutral_context,
    'sideALabel', i.side_a_label, 'sideBLabel', i.side_b_label,
    'category', i.category, 'countryCode', i.country_code, 'region', i.region,
    'originalLanguage', i.original_language, 'languages', (
      select coalesce(jsonb_agg(x.language order by x.language), '[]'::jsonb)
      from public.world_pulse_translations x
      where x.item_id = i.id and x.is_reviewed
    ),
    'eventDate', i.event_date, 'publishAt', i.publish_at, 'expiresAt', i.expires_at,
    'lastReviewedAt', i.last_reviewed_at, 'sensitivity', i.sensitivity,
    'sourceCount', i.source_count, 'createdAt', i.created_at, 'updatedAt', i.updated_at
  )
  from public.world_pulse_items i
  where public.can_edit_world_pulse()
  order by i.updated_at desc;
$$;
