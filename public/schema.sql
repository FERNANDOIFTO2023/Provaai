-- Provaai. Execute uma vez em um projeto Supabase novo.
begin;

create table public.sala_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check(length(name) between 2 and 80),
  grade text not null,
  subject text not null,
  period text not null default 'Manhã',
  color text not null default 'sage',
  created_at timestamptz not null default now(),
  unique(id,user_id)
);

create table public.sala_students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  class_id uuid not null,
  name text not null check(length(name) between 2 and 100),
  code text not null check(length(code) between 1 and 30),
  difficulties text not null default '',
  criteria text not null default '',
  level text not null default 'Intermediário',
  created_at timestamptz not null default now(),
  foreign key(class_id,user_id) references public.sala_classes(id,user_id),
  unique(class_id,code),
  unique(id,user_id),
  unique(id,class_id,user_id)
);

create table public.sala_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  filename text not null,
  path text not null,
  reference_text text not null default '',
  created_at timestamptz not null default now(),
  unique(id,user_id)
);

create table public.sala_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  class_id uuid not null,
  student_id uuid not null,
  template_id uuid,
  title text not null,
  subject text not null,
  topics text not null,
  question_count integer not null check(question_count between 1 and 30),
  status text not null default 'draft' check(status in ('draft','approved')),
  content jsonb not null,
  profile_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(student_id,class_id,user_id) references public.sala_students(id,class_id,user_id),
  foreign key(template_id,user_id) references public.sala_templates(id,user_id),
  unique(id,user_id)
);

create table public.sala_generation_jobs (
  exam_id uuid primary key,
  user_id uuid not null default auth.uid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  foreign key(exam_id,user_id) references public.sala_exams(id,user_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['sala_classes','sala_students','sala_templates','sala_exams','sala_generation_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('create index on public.%I(user_id)',t);
  end loop;
end $$;
create index on public.sala_students(class_id);
create index on public.sala_exams(student_id);
create or replace function public.sala_exam_revision() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if new.content is distinct from old.content or new.title is distinct from old.title or new.subject is distinct from old.subject then new.status='draft'; end if;
 new.updated_at=now(); return new; end $$;
create trigger exam_revision before update on public.sala_exams for each row execute function public.sala_exam_revision();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sala-templates','sala-templates',false,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy sala_files_read on storage.objects for select to authenticated using(bucket_id='sala-templates' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sala_files_create on storage.objects for insert to authenticated with check(bucket_id='sala-templates' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sala_files_delete on storage.objects for delete to authenticated using(bucket_id='sala-templates' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Restringe os privilégios da conta autenticada.
revoke truncate,references,trigger on public.sala_classes,public.sala_students,public.sala_templates,public.sala_exams,public.sala_generation_jobs from authenticated;
-- A função interna existe em alguns projetos Supabase; não é uma API do app.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
 end if;
end $$;

-- Estado da extração de texto dos modelos.
alter table public.sala_templates
 add column extracted_text text not null default '' check(length(extracted_text)<=60000),
 add column processing_status text not null default 'pending' check(processing_status in ('pending','ready','error')),
 add column processing_error text;

commit;
