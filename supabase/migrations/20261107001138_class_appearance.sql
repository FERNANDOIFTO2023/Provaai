begin;

alter table public.sala_classes
  add column banner_path text,
  add column banner_crop jsonb not null default '{"x":0.5,"y":0.5,"zoom":1}'::jsonb,
  add constraint sala_class_banner_owner check (banner_path is null or
    (banner_path like user_id::text || '/' || id::text || '/%' and
     banner_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$')),
  add constraint sala_class_banner_crop check (coalesce(
    jsonb_typeof(banner_crop)='object' and
    jsonb_typeof(banner_crop->'x')='number' and (banner_crop->>'x')::numeric between 0 and 1 and
    jsonb_typeof(banner_crop->'y')='number' and (banner_crop->>'y')::numeric between 0 and 1 and
    jsonb_typeof(banner_crop->'zoom')='number' and (banner_crop->>'zoom')::numeric between 1 and 3,false)),
  add constraint sala_classes_color_check check (color in ('sage','peach','blue','lilac','rose','amber','teal','indigo','coral','slate'));

alter table public.sala_classes drop constraint sala_classes_icon_check;
alter table public.sala_classes add constraint sala_classes_icon_check
  check(icon in ('book','users','graduation','science','sparkles','pencil','activity','geometry','projects','time'));
grant insert(banner_path,banner_crop),update(banner_path,banner_crop) on public.sala_classes to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('class-banners','class-banners',false,5242880,array['image/jpeg']);
create policy class_banner_read on storage.objects for select to authenticated
  using(bucket_id='class-banners' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy class_banner_create on storage.objects for insert to authenticated
  with check(bucket_id='class-banners' and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create policy class_banner_delete on storage.objects for delete to authenticated
  using(bucket_id='class-banners' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
