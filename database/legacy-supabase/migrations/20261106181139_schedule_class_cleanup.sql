-- Legado / referência histórica do Supabase
-- Agendamento de limpeza das turmas expiradas pelo pg_cron do Supabase.
-- Não integra as migrações Laravel atuais. Consulte este arquivo para entender
-- a origem dos dados e os comandos ExportLegacy e ImportLegacy antes de migrar.

-- Executa no banco mesmo quando nenhum professor está com o site aberto.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('provaai-purge-inactive-classes','15 3 * * *',
  $$select public.sala_purge_inactive_classes();$$);
