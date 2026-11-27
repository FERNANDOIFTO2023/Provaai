# Pastas diárias nas provas coletivas — 27/11/2026

## Alterações

Organizamos as provas dentro de cada turma da seção Provas coletivas em pastas recolhíveis por data de criação, com as mais recentes primeiro. As pastas são calculadas a partir das provas existentes: não criamos pastas para dias sem provas nem registros adicionais no banco. Uma turma sem provas continua exibindo o estado vazio.

Cada pasta apresenta a data, a quantidade de provas, o número em revisão e, quando aplicável, a quantidade selecionada. Mantivemos busca, filtros de situação, revisão, aprovação e seleção para download. A seleção geral abrange as aprovadas de todas as pastas filtradas, inclusive recolhidas; o texto da opção informa esse alcance. Filtros sem resultados não deixam pastas vazias.

Utilizamos `created_at` no fuso `America/Sao_Paulo`, o mesmo da data exibida nas provas. Editar ou aprovar não muda uma prova de pasta. Registros sem data válida ficam em “Data não informada”, preservando o acesso ao histórico. As provas individuais mantêm sua organização mensal.

Implementamos abertura e fechamento com `details`/`summary`, suporte nativo ao teclado e foco visível. A abertura da pasta não acrescenta entradas ao histórico; ao fechar a revisão, a pasta permanece aberta. Adaptamos as linhas ao celular, mantendo texto, situação e ação em espaços legíveis. A rotação do indicador respeita a preferência por movimento reduzido.

## Arquivos

- `components/exam-library.tsx`: pastas diárias opcionais nas linhas de provas; ativadas apenas na biblioteca coletiva.
- `lib/exam-library.ts`: agrupamento diário sem modificar os dados recebidos.
- `resources/css/bloub.css`: aparência das pastas, foco, indicador e disposição no celular.
- `tests/exam-months.test.ts`: cenários de agrupamento diário, virada de dia, ordem e separação das provas.
- `tests/browser/workspace-navigation.mjs`: novos cenários de pastas e adaptação dos testes existentes para abri-las antes da revisão; viewport de celular explícito.

## Validação

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado, sem erros de tipos. |
| `npm test` | 70 testes aprovados, nenhuma falha. |
| `npm run build` | Aprovado após o ajuste final de CSS. |
| `npm run test:navigation` | 22 cenários aprovados, nenhuma falha na execução final. |
| `git diff --check` | Sem erros de whitespace. |

Os testes de navegador utilizam Chrome headless e API simulada. Cobrimos desktop de 1440 px e celular de 375 px, agrupamento na virada do dia de Brasília, contagem, abertura pelo teclado, seleção em pasta recolhida, download ZIP com apenas as duas provas aprovadas, busca, filtro, ausência de pastas vazias, revisão e navegação Voltar/Avançar. Conferimos visualmente as capturas em ambas as larguras e acrescentamos uma verificação da largura mínima disponível ao texto no celular.

O ambiente não disponibilizava Node/npm no PATH inicial. Executamos os scripts npm com Node em `C:/Users/R3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` e a CLI em `C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`. Indicamos o Playwright disponível pelo `PLAYWRIGHT_MODULE` e o Chrome pelo `CHROME_PATH`. A variável opcional `NAVIGATION_SCREENSHOT_DIR` gravou as capturas em `C:/Users/R3/.cache/provaai-tools/pastas-2026-11-27`.

Na primeira execução dos novos cenários, corrigimos uma resposta de API simulada que devolvia uma lista em uma consulta de registro opcional. Uma execução intermediária de navegação também coincidiu com a reconstrução dos arquivos de build, interrompendo um recarregamento; repetimos a suíte completa sem reconstrução concorrente e todos os 22 cenários passaram. A inspeção visual identificou texto comprimido no celular; corrigimos a grade e repetimos os testes de navegação com a verificação de legibilidade.

## Avisos e entrega

O build mantém o aviso de bundle acima de 500 kB. Os testes de PDF emitiram avisos de fonte padrão e indexação, sem falhas. O Git informa conversão futura de LF para CRLF em arquivos de teste, sem erro de whitespace.

Não alteramos PHP, geração de questões, banco de dados ou serviços externos. Não foi necessária migração. A validação do navegador cobre o frontend com dados controlados e não representa um teste de disponibilidade dos provedores de IA em produção.

As alterações estão prontas localmente para revisão e commit pelo responsável. Não realizamos staging, commit, push ou implantação; a mudança aparecerá no site após a publicação da versão correspondente.
