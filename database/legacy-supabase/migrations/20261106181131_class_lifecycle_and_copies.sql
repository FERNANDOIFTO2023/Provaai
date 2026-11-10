begin;

alter table public.sala_classes
  add column icon text not null default 'book' check (icon in ('book','users','graduation','science','sparkles','pencil')),
  add column archived_at timestamptz,
  add column deletion_due_at timestamptz,
  add constraint class_archive_dates check ((archived_at is null and deletion_due_at is null) or
    (archived_at is not null and deletion_due_at > archived_at));
create index on public.sala_classes(deletion_due_at) where archived_at is not null;

-- Lifecycle fields and deletion are only available through the audited operations.
revoke insert,update,delete on public.sala_classes from authenticated;
grant insert(id,user_id,name,grade,subject,period,color,icon,created_at) on public.sala_classes to authenticated;
grant update(name,grade,subject,period,color,icon,template_override_id,use_provaai_template) on public.sala_classes to authenticated;

create table public.sala_class_deletions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  class_id uuid not null, class_name text not null, reason text not null check(length(trim(reason)) between 5 and 1000),
  automatic boolean not null default false, deleted_at timestamptz not null default now()
);
alter table public.sala_class_deletions enable row level security;
revoke all on public.sala_class_deletions from public,anon,authenticated;
grant select on public.sala_class_deletions to authenticated;
create policy deletion_owner on public.sala_class_deletions for select to authenticated using(user_id=(select auth.uid()));

create table public.sala_copy_invitations (
  id uuid primary key, owner_id uuid not null references auth.users(id), sender_email text not null,
  recipient_email text not null, kind text not null check(kind in ('class','student')),
  source_id uuid not null, source_class_id uuid not null, resource_name text not null,
  student_count integer not null, payload jsonb not null,
  created_at timestamptz not null default now(), accepted_at timestamptz, revoked_at timestamptz,
  accepted_by uuid references auth.users(id), result_class_id uuid,
  check (recipient_email=lower(trim(recipient_email)))
);
create index on public.sala_copy_invitations(recipient_email,created_at);
create index on public.sala_copy_invitations(owner_id,source_class_id);
alter table public.sala_copy_invitations enable row level security;
revoke all on public.sala_copy_invitations from public,anon,authenticated;
grant select(id,owner_id,sender_email,recipient_email,kind,resource_name,student_count,created_at,accepted_at,revoked_at)
  on public.sala_copy_invitations to authenticated;

create function public.sala_verified_email() returns text
language sql stable security definer set search_path='' as $$
  select lower(trim(email)) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
revoke all on function public.sala_verified_email() from public,anon;
grant execute on function public.sala_verified_email() to authenticated;
create policy copy_participant on public.sala_copy_invitations for select to authenticated
  using(owner_id=(select auth.uid()) or recipient_email=(select public.sala_verified_email()));

create function public.sala_assert_no_generation(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,19));
  if exists(select 1 from public.sala_exam_batches where user_id=p_owner and completed<cardinality(exam_ids))
    or exists(select 1 from public.sala_generation_jobs where user_id=p_owner and status='running' and started_at>now()-interval '4 minutes')
    then raise exception 'Aguarde a geração de provas terminar.'; end if;
end $$;
revoke all on function public.sala_assert_no_generation(uuid) from public,anon,authenticated;

create function public.sala_set_class_active(p_class uuid,p_active boolean) returns public.sala_classes
language plpgsql security definer set search_path='' as $$
declare room public.sala_classes; u uuid:=auth.uid();
begin
  if u is null or p_active is null then raise exception 'Confira a operação.'; end if;
  perform public.sala_assert_no_generation(u);
  select * into room from public.sala_classes where id=p_class and user_id=u for update;
  if not found then raise exception 'Turma não encontrada.'; end if;
  if room.deletion_due_at<=now() then raise exception 'O prazo de um ano para reativação terminou.'; end if;
  if p_active and room.archived_at is not null then
    update public.sala_classes set archived_at=null,deletion_due_at=null where id=p_class returning * into room;
  elsif not p_active and room.archived_at is null then
    update public.sala_classes set archived_at=now(),
      deletion_due_at=((now() at time zone 'UTC')+interval '1 year') at time zone 'UTC'
      where id=p_class returning * into room;
  end if;
  return room;
end $$;
revoke all on function public.sala_set_class_active(uuid,boolean) from public,anon;
grant execute on function public.sala_set_class_active(uuid,boolean) to authenticated;

create function public.sala_remove_class(p_class uuid,p_owner uuid,p_reason text,p_automatic boolean) returns void
language plpgsql security definer set search_path='' as $$
declare room public.sala_classes; deleted_exams uuid[];
begin
  if coalesce(length(trim(p_reason)),0) not between 5 and 1000 then raise exception 'Descreva o motivo da exclusão (5 a 1000 caracteres).'; end if;
  perform public.sala_assert_no_generation(p_owner);
  select * into room from public.sala_classes where id=p_class and user_id=p_owner for update;
  if not found then return; end if;
  if p_automatic and (room.deletion_due_at is null or room.deletion_due_at>now()) then return; end if;
  select array_agg(id) into deleted_exams from public.sala_exams where user_id=p_owner and
    (class_id=p_class or student_id in (select id from public.sala_students where class_id=p_class and user_id=p_owner));
  insert into public.sala_class_deletions(user_id,class_id,class_name,reason,automatic)
    values(p_owner,p_class,room.name,trim(p_reason),p_automatic);
  update public.sala_copy_invitations set revoked_at=now(),payload='{}'::jsonb
    where owner_id=p_owner and source_class_id=p_class and accepted_at is null and revoked_at is null;
  delete from public.sala_exam_batches where user_id=p_owner and exam_ids && coalesce(deleted_exams,'{}'::uuid[]);
  delete from public.sala_generation_jobs where user_id=p_owner and exam_id=any(deleted_exams);
  delete from public.sala_exams where user_id=p_owner and id=any(deleted_exams);
  delete from public.sala_recovery_students where user_id=p_owner and student_id in
    (select id from public.sala_students where class_id=p_class and user_id=p_owner);
  delete from public.sala_students where class_id=p_class and user_id=p_owner;
  delete from public.sala_classes where id=p_class and user_id=p_owner;
end $$;
revoke all on function public.sala_remove_class(uuid,uuid,text,boolean) from public,anon,authenticated;

create function public.sala_delete_class(p_class uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  perform public.sala_remove_class(p_class,auth.uid(),p_reason,false);
end $$;
revoke all on function public.sala_delete_class(uuid,text) from public,anon;
grant execute on function public.sala_delete_class(uuid,text) to authenticated;

create function public.sala_purge_inactive_classes() returns integer
language plpgsql security definer set search_path='' as $$
declare room record; removed integer:=0;
begin
  for room in select id,user_id from public.sala_classes where deletion_due_at<=now() loop
    perform public.sala_remove_class(room.id,room.user_id,'Exclusão automática após um ano de inatividade.',true);
    removed:=removed+1;
  end loop;
  return removed;
end $$;
revoke all on function public.sala_purge_inactive_classes() from public,anon,authenticated;

-- Keep all existing ownership policies. A copy never grants access to the original.
create function public.sala_send_copy(p_id uuid,p_kind text,p_resource uuid,p_email text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sender text:=public.sala_verified_email(); email text:=lower(trim(p_email));
  room public.sala_classes; pupil public.sala_students; pupils jsonb; room_data jsonb; previous public.sala_copy_invitations;
begin
  if sender is null then raise exception 'Confirme seu e-mail antes de compartilhar.'; end if;
  if email is null or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then raise exception 'Informe um e-mail válido.'; end if;
  if email=sender then raise exception 'Informe o e-mail de outro professor.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  select * into previous from public.sala_copy_invitations where id=p_id;
  if found then
    if previous.owner_id=u and previous.kind=p_kind and previous.source_id=p_resource and previous.recipient_email=email then return p_id; end if;
    raise exception 'Identificador de compartilhamento já utilizado.';
  end if;
  if p_kind='class' then
    select * into room from public.sala_classes where id=p_resource and user_id=u for update;
  elsif p_kind='student' then
    select * into pupil from public.sala_students where id=p_resource and user_id=u;
    select * into room from public.sala_classes where id=pupil.class_id and user_id=u for update;
  else raise exception 'Tipo de compartilhamento inválido.'; end if;
  if room.id is null then raise exception 'Turma ou aluno não encontrado.'; end if;
  if room.deletion_due_at<=now() then raise exception 'O prazo desta turma terminou.'; end if;
  room_data:=jsonb_build_object('name',room.name,'grade',room.grade,'subject',room.subject,'period',room.period,'color',room.color,'icon',room.icon);
  select coalesce(jsonb_agg(jsonb_build_object('name',s.name,'code',s.code,'difficulties',s.difficulties,
    'criteria',s.criteria,'level',s.level,'archived_at',s.archived_at) order by s.created_at,s.id),'[]'::jsonb)
    into pupils from public.sala_students s where s.user_id=u and s.class_id=room.id and (p_kind='class' or s.id=p_resource);
  insert into public.sala_copy_invitations(id,owner_id,sender_email,recipient_email,kind,source_id,source_class_id,resource_name,student_count,payload)
    values(p_id,u,sender,email,p_kind,p_resource,room.id,case when p_kind='class' then room.name else pupil.name end,
      jsonb_array_length(pupils),jsonb_build_object('classroom',room_data,'students',pupils));
  return p_id;
end $$;
revoke all on function public.sala_send_copy(uuid,text,uuid,text) from public,anon;
grant execute on function public.sala_send_copy(uuid,text,uuid,text) to authenticated;

create function public.sala_accept_copy(p_invitation uuid,p_class uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.sala_copy_invitations; u uuid:=auth.uid(); email text:=public.sala_verified_email();
  destination uuid; item jsonb; room jsonb; candidate text; highest numeric;
begin
  if email is null then raise exception 'Confirme seu e-mail para receber a cópia.'; end if;
  perform public.sala_assert_no_generation(u);
  select * into invitation from public.sala_copy_invitations where id=p_invitation and recipient_email=email for update;
  if not found or invitation.revoked_at is not null then raise exception 'Convite não disponível.'; end if;
  if invitation.accepted_at is not null then
    if invitation.accepted_by=u then return invitation.result_class_id; end if;
    raise exception 'Convite já utilizado.';
  end if;
  room:=invitation.payload->'classroom';
  if invitation.kind='class' then
    insert into public.sala_classes(user_id,name,grade,subject,period,color,icon)
      values(u,room->>'name',room->>'grade',room->>'subject',room->>'period',room->>'color',room->>'icon') returning id into destination;
  else
    select id into destination from public.sala_classes where id=p_class and user_id=u and archived_at is null for update;
    if destination is null then raise exception 'Escolha uma turma ativa da sua conta.'; end if;
  end if;
  for item in select value from jsonb_array_elements(invitation.payload->'students') loop
    if invitation.kind='class' then candidate:=item->>'code';
    else
      select coalesce(max(substring(upper(trim(code)) from 2)::numeric),0)+1 into highest from public.sala_students
        where class_id=destination and upper(trim(code)) ~ '^A[0-9]+$';
      if highest>=9007199254740991 then raise exception 'Não foi possível gerar um código para esta turma.'; end if;
      candidate:='A'||lpad(highest::text,greatest(3,length(highest::text)),'0');
    end if;
    insert into public.sala_students(user_id,class_id,name,code,difficulties,criteria,level,archived_at)
      values(u,destination,item->>'name',candidate,item->>'difficulties',item->>'criteria',item->>'level',(item->>'archived_at')::timestamptz);
  end loop;
  update public.sala_copy_invitations set accepted_at=now(),accepted_by=u,result_class_id=destination,payload='{}'::jsonb where id=p_invitation;
  return destination;
end $$;
revoke all on function public.sala_accept_copy(uuid,uuid) from public,anon;
grant execute on function public.sala_accept_copy(uuid,uuid) to authenticated;

create function public.sala_cancel_copy(p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.sala_copy_invitations set revoked_at=now(),payload='{}'::jsonb where id=p_invitation
    and (owner_id=auth.uid() or recipient_email=public.sala_verified_email()) and accepted_at is null and revoked_at is null;
end $$;
revoke all on function public.sala_cancel_copy(uuid) from public,anon;
grant execute on function public.sala_cancel_copy(uuid) to authenticated;

create function public.sala_require_active_class() returns trigger
language plpgsql security definer set search_path='' as $$
declare room uuid;
begin
  if tg_table_name='sala_generation_jobs' then
    select class_id into room from public.sala_exams where id=new.exam_id and user_id=new.user_id;
  else room:=new.class_id; end if;
  if tg_table_name='sala_students' and tg_op='UPDATE' then
    if new.class_id=old.class_id and (new.archived_at is not null or old.archived_at is null) then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,19));
  if not exists(select 1 from public.sala_classes where id=room and user_id=new.user_id and archived_at is null)
    then raise exception 'Reative a turma antes de adicionar alunos ou preparar provas.'; end if;
  return new;
end $$;
revoke all on function public.sala_require_active_class() from public,anon,authenticated;
create trigger require_active_student_class before insert or update of class_id,archived_at on public.sala_students
  for each row execute function public.sala_require_active_class();
create trigger require_active_exam_class before insert on public.sala_exams
  for each row execute function public.sala_require_active_class();
create trigger require_active_job_class before insert on public.sala_generation_jobs
  for each row execute function public.sala_require_active_class();
commit;
