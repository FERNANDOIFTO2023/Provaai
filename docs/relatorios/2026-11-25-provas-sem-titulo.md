# Retirada do título impresso nas provas

Data: 25/11/2026

## Alteração

O título cadastrado para organizar as provas no site não é mais acrescentado ao PDF ou DOCX do aluno. A mudança vale para o layout padrão, cabeçalhos extraídos de PDF e modelos Word. Campos vazios de Tema/Título reconhecidos no modelo Word deixam de receber esse título; sua estrutura de parágrafos e tabelas é preservada.

O cadastro e a tela de revisão continuam com o título. O gabarito mantém sua identificação anterior. Cabeçalhos, imagens, identificação do aluno, instruções, questões, fórmulas e áreas de resposta não tiveram suas regras alteradas. Textos já incorporados à imagem de um cabeçalho ou escritos no modelo original não são apagados.

A versão do cache passou de `export:v5` para `export:v6`, para que o próximo download reconstrua o arquivo sem reaproveitar a versão com título. Arquivos já baixados no computador não são modificados.

## Validação

- `npm run typecheck`: aprovado.
- `npm test`: 68 testes aprovados.
- `npm run build`: aprovado; permanece o aviso de bundle maior que 500 kB.
- `php artisan test --compact`: 103 testes aprovados, com 755 verificações, após concluir a instalação das dependências locais. Execução com PHP 8.3, `PHPRC` apontando para a configuração temporária de extensões, `PYTHON_BINARY` apontando para o ambiente virtual local e `APP_KEY` efêmera. Banco SQLite em memória e serviços de teste, sem acesso a contas reais.
- `git diff --check`: aprovado.
- `node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/office-converter.test.mjs`: dois testes aprovados após acrescentar a verificação de ausência do título no PDF convertido pelo LibreOffice.
- Os testes de modelos verificam ausência do título com e sem campo Tema, preservação do cabeçalho, margens, identificação e questões. O cenário com modelo PDF também verifica cabeçalho somente na primeira página.

## Ambiente local

A primeira execução do backend encontrou ausência das extensões do PHP e da chave de teste. A execução seguinte identificou a dependência OpenSpout ausente em `vendor`. As extensões foram carregadas pela configuração local de testes, a chave foi gerada apenas para o processo e `composer install --no-interaction --prefer-dist --no-scripts` instalou a dependência já registrada no lockfile, sem atualizar versões. Um arquivo `.env.testing` vazio e temporário evita os avisos de arquivo ausente e é removido após a execução.

Sem staging, commit, push ou deploy. A publicação fica com o responsável.
