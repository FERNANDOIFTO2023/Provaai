# Área do professor — adaptação visual do Figma

Data: 27/11/2026.

## Implementação

Adaptamos a Área do professor a partir da referência compartilhada no [Figma](https://www.figma.com/design/wYB3lwzPH2NmlZgX10nony/FERNANDO-DE-PAULA-MATOS-s-team-library?node-id=411-254). Consultamos a estrutura, a captura completa e os detalhes dos cartões Production Status, Quality Panel e Worker Status. A conexão passou a funcionar após a autenticação com a conta proprietária do arquivo.

Aplicamos cartões brancos com bordas discretas, cantos de 16 px, cabeçalho compacto, indicadores lado a lado e gráficos circulares. Mantivemos a identidade violeta e verde do Provaai, seus ícones, componentes, tipografia e dados reais. A referência industrial foi adaptada ao domínio educacional, conforme solicitado; não introduzimos indicadores de máquinas, trabalhadores, metas inventadas ou controles sem função.

- Acrescentamos o panorama das provas com três anéis animados: aprovadas, coletivas e individuais, cada um proporcional ao total do período. A legenda informa os valores e explica que aprovação e tipo são classificações sobrepostas.
- Reorganizamos os quatro indicadores existentes em um cartão de resumo, com uma barra de aprovadas e provas com questões em revisão.
- Substituímos o banner amplo por uma saudação compacta, com data no fuso do projeto e acesso às turmas.
- Preservamos filtros mensal/trimestral/anual, calendário com intensidade por quantidade, gráfico de atividade, consumo de tokens e ranking de turmas.
- Mantivemos os estados de carregamento, falha e ausência de dados; ausência de medição continua representada por “—”. Nenhum arco colorido é apresentado quando não há provas.
- Reutilizamos React, CSS e Motion já instalados. Os gráficos são vetoriais e calculados com o retorno da API; a captura do Figma não faz parte da interface nem há dependência de URLs temporárias do Figma.
- O perfil continua sem envio de foto. A navegação, autenticação e geração de provas não foram alteradas.

## Arquivos desta entrega

- `components/teacher-dashboard.tsx`: panorama e nova composição do resumo.
- `resources/css/teacher-dashboard.css`: apresentação e adaptações responsivas.
- `tests/browser/teacher-dashboard.mjs`: verificações dos novos indicadores, estados e capturas.
- `docs/relatorios/2026-11-27-area-professor/`: evidências visuais com dados simulados.

As alterações locais das pastas diárias de provas coletivas pertencem à entrega anterior e foram preservadas.

## Validação executada

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado, sem erros. |
| `npm test` | 70 testes aprovados; nenhuma falha. |
| `npm run build` | Aprovado. |
| `node --experimental-strip-types tests/browser/teacher-dashboard.mjs` | Aprovado nas quatro larguras: 1440, 768, 375 e 320 px. |
| `git diff --check` | Sem erros de whitespace. |

Executamos os scripts npm usando Node disponível em `C:/Users/R3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` e a CLI npm em `C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`. Para o navegador, indicamos o Playwright do runtime com `PLAYWRIGHT_MODULE` e o Chrome instalado com `CHROME_PATH`.

Nos testes de navegador, verificamos valores do panorama e do resumo contra os dados controlados, ausência de foto, meses e períodos, intensidade do calendário, uso pelo teclado, tabela alternativa ao gráfico, erro e nova tentativa, ausência de valores antigos após erro, ausência de arcos fictícios no estado vazio, retorno pelo histórico e ausência de rolagem horizontal. Conferimos visualmente as capturas de desktop, tablet e celular. As animações respeitam a preferência de movimento reduzido.

Evidências:

- [Desktop — 1440 px](2026-11-27-area-professor/painel-1440.png)
- [Tablet — 768 px](2026-11-27-area-professor/painel-768.png)
- [Celular — 375 px](2026-11-27-area-professor/painel-375.png)
- [Celular — 320 px](2026-11-27-area-professor/painel-320.png)

## Avisos e limites

O build mantém o aviso de bundle maior que 500 kB. Os testes existentes de PDF emitiram avisos de fonte padrão e indexação, sem falhas. O Git informa conversão futura de LF para CRLF em alguns arquivos, sem erros de whitespace.

Os testes visuais usam API simulada, com dados identificados neste relatório como ilustrativos. Em produção, o painel continua consultando `/api/teacher/dashboard`; não alteramos o contrato ou os cálculos do backend. Não foi necessária migração nem alteração PHP. Esta entrega não valida a disponibilidade dos provedores de IA na produção.

As alterações permanecem locais para revisão e commit pelo responsável. Não realizamos staging, commit, push nem publicação. A nova interface aparecerá no site após a implantação da versão correspondente.
