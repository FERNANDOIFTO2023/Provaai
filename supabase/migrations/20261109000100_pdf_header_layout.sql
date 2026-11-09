-- PDFs são modelos visuais. O recorte usa a primeira página, sem perguntas antigas.
alter table public.sala_templates
  add column pdf_header_ratio double precision not null default 0.25
  check (pdf_header_ratio between 0.05 and 0.45);
