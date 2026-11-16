-- Legado / referência histórica do Supabase
-- Proporção do cabeçalho de modelos PDF com limite entre 5% e 45% da página.
-- Não integra as migrações Laravel atuais. Consulte este arquivo para entender
-- a origem dos dados e os comandos ExportLegacy e ImportLegacy antes de migrar.

-- PDFs são modelos visuais. O recorte usa a primeira página, sem perguntas antigas.
alter table public.sala_templates
  add column pdf_header_ratio double precision not null default 0.25
  check (pdf_header_ratio between 0.05 and 0.45);
