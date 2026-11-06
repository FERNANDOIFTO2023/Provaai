begin;
alter table public.sala_students add column archived_at timestamptz;
alter table public.sala_exams add column purpose text not null default 'regular'
  check (purpose in ('regular','recovery'));
create table public.sala_recovery_students (
  user_id uuid not null default auth.uid() references auth.users(id),
  student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,student_id),
  foreign key(student_id,user_id) references public.sala_students(id,user_id)
);
alter table public.sala_recovery_students enable row level security;
revoke all on public.sala_recovery_students from public,anon,authenticated;
grant select,insert,delete on public.sala_recovery_students to authenticated;
create policy recovery_owner_read on public.sala_recovery_students for select to authenticated
  using(user_id=(select auth.uid()));
create policy recovery_owner_add on public.sala_recovery_students for insert to authenticated
  with check(user_id=(select auth.uid()) and exists(select 1 from public.sala_students s
    where s.id=student_id and s.user_id=(select auth.uid()) and s.archived_at is null));
create policy recovery_owner_remove on public.sala_recovery_students for delete to authenticated
  using(user_id=(select auth.uid()));
create index on public.sala_exams(user_id,purpose,class_id);

create or replace function public.sala_begin_exam_batch(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid(); room public.sala_classes; ids uuid[]; pupils uuid[];
  model uuid; choice text := p_input->>'choice'; label text; n int; objectives int;
  purpose text := coalesce(p_input->>'purpose','regular');
  batch uuid := gen_random_uuid(); retry uuid := (p_input->>'retry')::uuid;
begin
  if u is null then raise exception 'Entre na sua conta.'; end if;
  if purpose not in ('regular','recovery') then raise exception 'Tipo de avaliação inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 19));
  if exists(select 1 from public.sala_exam_batches where user_id=u and completed<cardinality(exam_ids))
    or exists(select 1 from public.sala_generation_jobs where user_id=u and status='running' and started_at>now()-interval '4 minutes')
    then raise exception 'Você já tem uma geração em andamento.'; end if;
  if retry is not null then
    select e.title,e.template_id into strict label,model from public.sala_exams e where e.id=retry and e.user_id=u
      and exists(select 1 from public.sala_students s where s.id=e.student_id and s.user_id=u and s.archived_at is null)
      and status='draft' and jsonb_array_length(content->'questions')=0;
    ids:=array[retry];
  else
    select * into strict room from public.sala_classes where id=(p_input->>'classId')::uuid and user_id=u;
    select array_agg(value::uuid) into pupils from jsonb_array_elements_text(p_input->'students');
    label:=trim(p_input->>'title'); n:=(p_input->>'count')::int; objectives:=(p_input->>'objectiveCount')::int;
    if coalesce(cardinality(pupils),0) not between 1 and 1000 or coalesce(length(label),0) not between 1 and 120
      or coalesce(length(trim(p_input->>'topics')),0) not between 1 and 3000 or coalesce(n,0) not between 1 and 30
      or coalesce(objectives,-1) not between 0 and n or choice is null then raise exception 'Confira os dados da prova.'; end if;
    if choice='inherit' then select template_id into model from public.sala_teacher_template_defaults where user_id=u;
    elsif choice<>'builtin' then model:=choice::uuid; end if;
    if purpose='recovery' and (cardinality(pupils)<>1 or not exists(
      select 1 from public.sala_recovery_students where user_id=u and student_id=pupils[1]
    )) then raise exception 'Selecione um aluno cadastrado na recuperação.'; end if;
    if purpose='regular' then
    update public.sala_classes set template_override_id=case when choice not in ('inherit','builtin') then model end,
      use_provaai_template=(choice='builtin') where id=room.id;
    end if;
    with drafts as (
      insert into public.sala_exams(user_id,class_id,student_id,template_id,title,subject,topics,question_count,purpose,content,profile_snapshot)
      select u,room.id,s.id,model,label,room.subject,trim(p_input->>'topics'),n,purpose,
        jsonb_build_object('questions','[]'::jsonb,'instructions','','objectiveCount',objectives),
        jsonb_build_object('name',s.name,'code',s.code,'level',s.level,'criteria',s.criteria,'difficulties',s.difficulties)
      from public.sala_students s where s.user_id=u and s.class_id=room.id and s.id=any(pupils) and s.archived_at is null returning id
    ) select array_agg(id) into ids from drafts;
    if cardinality(ids) is distinct from cardinality(pupils) then raise exception 'Confira os alunos desta turma.'; end if;
  end if;
  if model is not null and not exists(select 1 from public.sala_templates where id=model and user_id=u and processing_status='ready')
    then raise exception 'Aguarde a leitura do modelo.'; end if;
  insert into public.sala_exam_batches(user_id,batch_id,title,exam_ids) values(u,batch,label,ids)
  on conflict(user_id) do update set batch_id=batch,title=label,exam_ids=ids,completed=0,failed=0,last_error=null,lease=null,lease_until=null;
  return batch;
end $$;

create function public.sala_require_active_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare pupil uuid;
begin
  if tg_table_name='sala_exams' then pupil:=new.student_id;
  else select student_id into pupil from public.sala_exams where id=new.exam_id and user_id=new.user_id;
  end if;
  if not exists(select 1 from public.sala_students where id=pupil and user_id=new.user_id and archived_at is null)
    then raise exception 'Restaure o aluno na turma antes de preparar novas provas.'; end if;
  return new;
end $$;
revoke all on function public.sala_require_active_student() from public,anon,authenticated;
create trigger require_active_exam_student before insert on public.sala_exams
  for each row execute function public.sala_require_active_student();
create trigger require_active_generation_student before insert on public.sala_generation_jobs
  for each row execute function public.sala_require_active_student();
commit;
