# Apresentação da arquitetura e evolução do Provaai

Criado `docs/apresentacao/Provaai-Arquitetura-e-Evolucao.pdf`, com sete páginas. O resumo anterior foi preservado.

## Conteúdo

- Contexto acadêmico, integrantes e professor, funcionalidades e cronologia.
- Arquitetura inicial Next.js/Supabase e comparação com Laravel/React/Vite.
- Transferência de dados, preservação de UUIDs, validação de arquivos e corte registrado em 11/11/2026.
- Vercel como proxy público, origem AWS, EC2, Docker, Nginx, PHP-FPM, workers e armazenamento.
- Rotas HTTP, dados, login por e-mail, importação de alunos e compartilhamento de cópias.
- Geração, provedores, referências, validação, documentos e matemática.
- Publicação, CI, segurança, testes e limitações.

## Evidências e validação

Conteúdo conferido com README, guias de migração/técnico/documentos, especificação acadêmica, segurança legada e arquivos reais de rotas, inicialização, publicação, processos e CI. A data inicial é indicada como aproximada, e a situação documentada é distinguida de uma nova verificação de produção.

Executado com sucesso o gerador `C:/Users/R3/.cache/provaai-tools/apresentacao-arquitetura.py`, utilizando o Python do runtime de documentos. ReportLab produziu o arquivo; pypdf confirmou sete páginas e os termos centrais; pypdfium2 renderizou todas as páginas para inspeção visual. As sete páginas foram conferidas sem cortes ou sobreposições. Após ajustar as quebras na tabela de rotas e o texto de versionamento, o PDF foi regenerado e as páginas afetadas foram novamente inspecionadas.

Executado `git diff --check` antes da entrega. Não houve modificação do código da aplicação, instalação de dependências, chamada a provedores de IA nem alteração de infraestrutura. Não se repetiram testes da aplicação para esta entrega documental. PDF pronto para apresentação e revisão. Sem staging, commit ou push.

## Complemento para leitores sem formação técnica

Atualizado o mesmo PDF a pedido do usuário. Mantidas as sete páginas de explicação do projeto, com definições no contexto para aplicação web, backend, PostgreSQL, Next.js, VM, API, frontend, JSON, rotas e workers. Acrescentadas cinco páginas de glossário temático, com 110 entradas que agrupam termos relacionados: conceitos da aplicação; plataformas e execução; dados e segurança; IA e arquivos; desenvolvimento e publicação. Total final: 12 páginas.

Executado `C:/Users/R3/.cache/provaai-tools/apresentacao-acessivel.py` com o Python do runtime de documentos. A primeira montagem produziu páginas excedentes no glossário; foi ajustado o espaçamento, preservando a fonte de 10,5 pontos. Na montagem final, pypdf confirmou 12 páginas e a presença das seções e termos selecionados. As 12 páginas foram renderizadas com pypdfium2 e inspecionadas: conteúdo legível, rodapés consistentes, sem cortes ou sobreposições. `git diff --check` repetido antes da entrega. Sem alteração de código da aplicação, staging, commit ou publicação.
