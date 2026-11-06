-- Runs in the database even when no teacher has the site open.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('provaai-purge-inactive-classes','15 3 * * *',
  $$select public.sala_purge_inactive_classes();$$);
