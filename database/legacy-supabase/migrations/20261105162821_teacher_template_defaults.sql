create table public.sala_teacher_template_defaults (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid,
  foreign key (template_id, user_id) references public.sala_templates(id, user_id) on delete cascade
);
alter table public.sala_teacher_template_defaults enable row level security;
revoke all on public.sala_teacher_template_defaults from public, anon, authenticated;
grant select, insert, update on public.sala_teacher_template_defaults to authenticated;
create policy teacher_default_read on public.sala_teacher_template_defaults for select to authenticated
  using (user_id = (select auth.uid()));
create policy teacher_default_create on public.sala_teacher_template_defaults for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy teacher_default_change on public.sala_teacher_template_defaults for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Sem uma escolha própria, turmas novas e existentes seguem o padrão do professor.
alter table public.sala_classes
  add column template_override_id uuid,
  add column use_provaai_template boolean not null default false,
  add check (not use_provaai_template or template_override_id is null),
  add foreign key (template_override_id, user_id) references public.sala_templates(id, user_id)
    on delete set null (template_override_id);
create index sala_classes_template_override_idx on public.sala_classes(template_override_id)
  where template_override_id is not null;
create index sala_teacher_default_template_idx on public.sala_teacher_template_defaults(template_id)
  where template_id is not null;
