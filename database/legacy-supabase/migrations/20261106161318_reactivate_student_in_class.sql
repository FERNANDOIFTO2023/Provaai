begin;

-- A prova conserva a turma em que foi criada, mesmo após a transferência do aluno.
alter table public.sala_exams drop constraint sala_exams_student_id_class_id_user_id_fkey;
alter table public.sala_exams
  add constraint sala_exams_student_owner_fkey foreign key(student_id,user_id) references public.sala_students(id,user_id),
  add constraint sala_exams_class_owner_fkey foreign key(class_id,user_id) references public.sala_classes(id,user_id);

create function public.sala_guard_exam_class() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if (new.student_id,new.class_id,new.user_id) is not distinct from (old.student_id,old.class_id,old.user_id) then return new; end if;
  end if;
  if not exists(select 1 from public.sala_students where id=new.student_id and user_id=new.user_id and class_id=new.class_id)
    then raise exception 'O aluno não pertence à turma selecionada.'; end if;
  return new;
end $$;
revoke all on function public.sala_guard_exam_class() from public,anon,authenticated;
create trigger guard_exam_class before insert or update of student_id,class_id,user_id on public.sala_exams
  for each row execute function public.sala_guard_exam_class();

create function public.sala_guard_student_enrollment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.class_id,new.archived_at) is not distinct from (old.class_id,old.archived_at) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,19));
  if exists(select 1 from public.sala_exam_batches where user_id=new.user_id and completed<cardinality(exam_ids))
    or exists(select 1 from public.sala_generation_jobs where user_id=new.user_id and status='running' and started_at>now()-interval '4 minutes')
    then raise exception 'Aguarde a geração de provas terminar antes de alterar o vínculo do aluno.'; end if;
  if new.class_id is distinct from old.class_id and (old.archived_at is null or new.archived_at is not null)
    then raise exception 'Retire o aluno da turma antes de reativá-lo em outra turma.'; end if;
  return new;
end $$;
revoke all on function public.sala_guard_student_enrollment() from public,anon,authenticated;
create trigger guard_student_enrollment before update of class_id,archived_at on public.sala_students
  for each row execute function public.sala_guard_student_enrollment();

create function public.sala_reactivate_student(p_student uuid,p_class uuid) returns public.sala_students
language plpgsql security invoker set search_path='' as $$
declare
  u uuid:=auth.uid(); pupil public.sala_students; candidate text; highest numeric; attempt int;
begin
  if u is null then raise exception 'Entre na sua conta.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  select * into pupil from public.sala_students where id=p_student and user_id=u for update;
  if not found then raise exception 'Aluno não encontrado.'; end if;
  if pupil.archived_at is null then raise exception 'Este aluno já está ativo. Atualize a lista.'; end if;
  perform 1 from public.sala_classes where id=p_class and user_id=u for update;
  if not found then raise exception 'Escolha uma turma da sua conta.'; end if;
  for attempt in 1..5 loop
    if p_class=pupil.class_id then candidate:=pupil.code;
    else
      select coalesce(max(substring(upper(trim(code)) from 2)::numeric),0) into highest
        from public.sala_students where class_id=p_class and user_id=u and upper(trim(code)) ~ '^A[0-9]+$';
      if highest>=9007199254740991 then raise exception 'Não foi possível gerar um código para esta turma.'; end if;
      candidate:='A'||lpad((highest+1)::text,greatest(3,length((highest+1)::text)),'0');
    end if;
    begin
      update public.sala_students set class_id=p_class,code=candidate,archived_at=null
        where id=p_student and user_id=u returning * into pupil;
      insert into public.sala_recovery_students(user_id,student_id) values(u,p_student) on conflict do nothing;
      return pupil;
    exception when unique_violation then
      if attempt=5 then raise exception 'A turma recebeu novos cadastros. Tente reativar o aluno novamente.'; end if;
    end;
  end loop;
  raise exception 'Não foi possível reativar o aluno.';
end $$;
revoke all on function public.sala_reactivate_student(uuid,uuid) from public,anon;
grant execute on function public.sala_reactivate_student(uuid,uuid) to authenticated;

create or replace function public.sala_require_active_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare pupil uuid; room uuid;
begin
  if tg_table_name='sala_exams' then pupil:=new.student_id; room:=new.class_id;
  else select student_id,class_id into pupil,room from public.sala_exams where id=new.exam_id and user_id=new.user_id;
  end if;
  if not exists(select 1 from public.sala_students where id=pupil and user_id=new.user_id and archived_at is null)
    then raise exception 'Reative o aluno antes de preparar novas provas.'; end if;
  if not exists(select 1 from public.sala_students where id=pupil and user_id=new.user_id and class_id=room)
    then raise exception 'Prepare uma nova prova na turma atual do aluno.'; end if;
  return new;
end $$;

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
      and exists(select 1 from public.sala_students s where s.id=e.student_id and s.user_id=u and s.class_id=e.class_id and s.archived_at is null)
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


commit;
