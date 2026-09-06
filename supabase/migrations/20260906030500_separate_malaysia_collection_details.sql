alter table public.store_settings
  add column if not exists malaysia_collection_point_details jsonb not null default '[]'::jsonb,
  add column if not exists malaysia_collection_address text not null default '',
  add column if not exists malaysia_collection_area_label text not null default '',
  add column if not exists malaysia_google_maps_url text not null default '';

update public.store_settings
set
  malaysia_collection_point_details = case
    when jsonb_array_length(coalesce(malaysia_collection_point_details, '[]'::jsonb)) = 0 then
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', point_name,
          'area', point_name,
          'address', point_name,
          'google_maps_url', ''
        ))
        from jsonb_array_elements_text(coalesce(malaysia_collection_points, '[]'::jsonb)) as point(point_name)
      ), '[]'::jsonb)
    else malaysia_collection_point_details
  end,
  malaysia_collection_area_label = case
    when coalesce(malaysia_collection_area_label, '') = '' then coalesce(malaysia_collection_points->>0, '')
    else malaysia_collection_area_label
  end;
