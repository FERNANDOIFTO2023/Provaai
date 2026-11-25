# Resumo técnico em PDF para apresentação

Criado `docs/apresentacao/Provaai-Resumo-Tecnico.pdf`, com duas páginas A4 sobre tecnologias, arquitetura, principais rotas, geração, segurança e testes. Conteúdo baseado na leitura do código e das configurações do projeto realizada nesta conversa. Não altera o funcionamento da aplicação.

## Validação

- Executado o gerador local `C:/Users/R3/.cache/provaai-tools/resumo-apresentacao.py` com o Python do runtime de documentos: sucesso.
- PDF produzido com ReportLab; leitura com pypdf confirmou duas páginas e presença dos termos e endpoints principais.
- Renderizadas as duas páginas com pypdfium2 e inspecionadas visualmente: tabelas legíveis, acentuação correta e ausência de cortes ou sobreposições.
- Executado `git diff --check` antes da entrega.
- Não foram executados testes da aplicação: esta entrega contém somente um documento e este relatório, sem mudanças de código.

## Escopo e limites

O resumo apresenta as rotas principais, não um catálogo completo da API. Não constitui nova auditoria de segurança ou de disponibilidade dos serviços. A primeira sondagem do ambiente constatou ausência de PyMuPDF; a renderização foi concluída com pypdfium2, já disponível, sem instalar dependências.

PDF pronto para apresentação e revisão. Sem staging, commit ou push. Alterações anteriores do projeto não fazem parte desta entrega.
