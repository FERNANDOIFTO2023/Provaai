create table public.sala_exam_batches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  batch_id uuid not null default gen_random_uuid(), title text not null,
  exam_ids uuid[] not null, completed integer not null default 0, failed integer not null default 0,
  last_error text, lease uuid, lease_until timestamptz
);
alter table public.sala_exam_batches enable row level security;
revoke all on public.sala_exam_batches from public, anon, authenticated;
grant select(user_id,batch_id,title,exam_ids,completed,failed,last_error,lease_until)
  on public.sala_exam_batches to authenticated;
create policy batch_owner on public.sala_exam_batches for select to authenticated
  using (user_id=(select auth.uid()));

create function public.sala_begin_exam_batch(p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid(); room public.sala_classes; ids uuid[]; pupils uuid[];
  model uuid; choice text := p_input->>'choice'; label text; n int; objectives int;
  batch uuid := gen_random_uuid(); retry uuid := (p_input->>'retry')::uuid;
begin
  if u is null then raise exception 'Entre na sua conta.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 19));
  if exists(select 1 from public.sala_exam_batches where user_id=u and completed<cardinality(exam_ids))
    or exists(select 1 from public.sala_generation_jobs where user_id=u and status='running' and started_at>now()-interval '4 minutes')
    then raise exception 'Você já tem uma geração em andamento.'; end if;
  if retry is not null then
    select title,template_id into strict label,model from public.sala_exams where id=retry and user_id=u
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
    update public.sala_classes set template_override_id=case when choice not in ('inherit','builtin') then model end,
      use_provaai_template=(choice='builtin') where id=room.id;
    with drafts as (
      insert into public.sala_exams(user_id,class_id,student_id,template_id,title,subject,topics,question_count,content,profile_snapshot)
      select u,room.id,s.id,model,label,room.subject,trim(p_input->>'topics'),n,
        jsonb_build_object('questions','[]'::jsonb,'instructions','','objectiveCount',objectives),
        jsonb_build_object('name',s.name,'code',s.code,'level',s.level,'criteria',s.criteria,'difficulties',s.difficulties)
      from public.sala_students s where s.user_id=u and s.class_id=room.id and s.id=any(pupils) returning id
    ) select array_agg(id) into ids from drafts;
    if cardinality(ids) is distinct from cardinality(pupils) then raise exception 'Confira os alunos desta turma.'; end if;
  end if;
  if model is not null and not exists(select 1 from public.sala_templates where id=model and user_id=u and processing_status='ready')
    then raise exception 'Aguarde a leitura do modelo.'; end if;
  insert into public.sala_exam_batches(user_id,batch_id,title,exam_ids) values(u,batch,label,ids)
  on conflict(user_id) do update set batch_id=batch,title=label,exam_ids=ids,completed=0,failed=0,last_error=null,lease=null,lease_until=null;
  return batch;
end $$;

create function public.sala_claim_exam_step() returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.sala_exam_batches; item uuid; token uuid:=gen_random_uuid();
begin
  select * into b from public.sala_exam_batches where user_id=auth.uid() for update;
  if not found or b.completed>=cardinality(b.exam_ids) or b.lease_until>now() then return null; end if;
  item:=b.exam_ids[b.completed+1];
  delete from public.sala_generation_jobs where user_id=b.user_id and exam_id=item and status='running' and started_at<now()-interval '3 minutes';
  update public.sala_exam_batches set lease=token,lease_until=now()+interval '3 minutes' where user_id=b.user_id;
  return jsonb_build_object('examId',item,'lease',token);
end $$;

create function public.sala_finish_exam_step(p_lease uuid,p_error text) returns boolean
language sql security definer set search_path='' as $$
  update public.sala_exam_batches set completed=completed+1,failed=failed+(p_error is not null)::int,
    last_error=coalesce(left(p_error,300),last_error), lease=null,lease_until=null
    where user_id=auth.uid() and lease=p_lease returning completed<cardinality(exam_ids)
$$;

create function public.sala_guard_generation() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.sala_exam_batches;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,19));
  select * into b from public.sala_exam_batches where user_id=new.user_id and completed<cardinality(exam_ids);
  if found then
    if tg_table_name='sala_exams' then raise exception 'Aguarde o lote em andamento.'; end if;
    if b.exam_ids[b.completed+1] <> new.exam_id or b.lease_until is null or b.lease_until<=now()
      then raise exception 'Aguarde o lote em andamento.'; end if;
  end if;
  if exists(select 1 from public.sala_generation_jobs where user_id=new.user_id and status='running' and started_at>now()-interval '3 minutes')
    then raise exception 'Já existe uma geração em andamento.'; end if;
  return new;
end $$;
create trigger guard_exam_generation before insert on public.sala_generation_jobs for each row execute function public.sala_guard_generation();
create trigger guard_exam_creation before insert on public.sala_exams for each row execute function public.sala_guard_generation();
revoke all on function public.sala_guard_generation() from public,anon,authenticated;
revoke all on function public.sala_begin_exam_batch(jsonb),public.sala_claim_exam_step(),public.sala_finish_exam_step(uuid,text) from public,anon;
grant execute on function public.sala_begin_exam_batch(jsonb),public.sala_claim_exam_step(),public.sala_finish_exam_step(uuid,text) to authenticated;
