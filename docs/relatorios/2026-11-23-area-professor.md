# Área do professor: atividade e consumo de IA

Data: 23/11/2026. Alterações locais, sem staging, commit, push ou publicação.

## Resultado

O botão **Meu espaço / Área do professor**, acima do menu lateral, abre o painel. Também há acesso pelo seletor do cabeçalho. A entrada habitual em Minhas turmas foi preservada.

- Resumos de provas, aprovações, questões e tokens.
- Períodos de um, três ou doze meses, encerrados no mês escolhido.
- Gráfico de barras com provas coletivas e individuais e tabela equivalente acessível.
- Calendário mensal clicável, com quantidade por dia e faixas fixas de cor: zero, 1–2, 3–5, 6–10 e 11 ou mais provas. Dias futuros ficam desabilitados.
- Turmas com mais provas e totais atuais de alunos e turmas ativos.
- Entrada animada do painel, crescimento das barras e mascote existente; preferência de movimento reduzido respeitada.
- Layout responsivo, foco visível, estados de carregamento, erro, nova tentativa e ausência de dados.
- Perfil continua sem opção de enviar foto.

## Definição dos indicadores

Cada registro de prova com questões conta uma vez, pela data de criação, no fuso `America/Sao_Paulo`. Isso permite incluir o histórico existente sem inventar datas de conclusão. Rascunhos vazios não contam; provas apagadas deixam de aparecer. Uma edição não conta como nova prova. Aprovação representa o estado atual das provas criadas no período. Turmas e alunos ativos são totais atuais, conforme os rótulos, não históricos.

A API consulta todos os registros do período, sem o limite de mil itens da listagem. O gráfico mensal agrupa dias em intervalos de sete dias; nos demais períodos, agrupa por mês. O calendário sempre mostra o mês de referência. Os dados atualizam ao abrir o painel, trocar filtros ou usar **Atualizar dados**, sem consulta periódica em segundo plano.

## Medição de IA

`AiUsage` registra cada requisição efetiva de geração, revisão ou pesquisa, inclusive tentativas, fallback e respostas rejeitadas. Gemini, Groq e Mistral usam os valores informados pelos próprios provedores. Pesquisas atendidas pelo cache local não criam um evento novo. O código de geração e seus critérios de validação foram preservados.

O total utiliza o campo de total do provedor; não soma novamente cache ou raciocínio. Entrada e saída têm contadores de disponibilidade separados. Ausência de metadados aparece como desconhecida, não como consumo zero confirmado. Falhas de conexão também são registradas sem atribuir tokens fictícios. A duração é por chamada HTTP, não o tempo total de preparação da prova. Não há conversão em preço ou cobrança.

O histórico anterior à instalação não tinha medição de tokens e não foi estimado. O painel informa quando a medição começou e quando o total é parcial. Falha ao salvar telemetria é registrada no log sem descartar a resposta da IA; nesse caso, a medição pode ficar incompleta.

Referências oficiais consultadas para os campos de uso:

- [Gemini: GenerateContent / UsageMetadata](https://aistudio.google.com/api-reference/generate-content).
- [Groq: campos de uso e cache](https://console.groq.com/docs/prompt-caching).
- [Mistral: campos de uso e cache](https://docs.mistral.ai/inference/conversations/advanced/prompt-caching).

## Segurança e persistência

`GET /api/teacher/dashboard` exige sessão, limita requisições e usa apenas o identificador do professor autenticado. Consultas de provas, turmas, alunos e consumo são filtradas pelo proprietário. A resposta usa `private, no-store`, contém agregados e nomes das próprias turmas, sem nomes de alunos, enunciados ou anexos.

A migração `2026_11_23_180000_create_ai_usage_events.php` cria a tabela de métricas com vínculo ao usuário, exclusão em cascata e índice por usuário/data. Guarda provedor, modelo, etapa, contagens, duração, status HTTP e data. Não guarda prompts, documentos, respostas ou credenciais. Não há endpoint público de escrita das métricas.

## Validações

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado, sem erros TypeScript. |
| `npm test` | 63 testes aprovados. |
| `npm run build` | Aprovado. |
| `php artisan test --no-ansi` | 91 testes, 678 verificações aprovadas na execução final. |
| `php artisan test --filter=TeacherDashboardTest --no-ansi` | 8 testes, 63 verificações aprovadas. |
| `node tests/browser/workspace-navigation.mjs` | 17 cenários de navegação aprovados. |
| `node --experimental-strip-types tests/browser/teacher-dashboard.mjs` | Aprovado em 1440, 768, 375 e 320 px. |
| `git diff --check` | Aprovado. |

Aviso do build: o pacote principal ficou em 641,94 kB (188,22 kB gzip), acima do limiar de aviso de 500 kB do Vite. O build concluiu normalmente. Não foram adicionadas bibliotecas; gráficos e calendário usam React, CSS e a biblioteca de movimento já presente.

Os testes PHP cobrem isolamento entre professores, tentativa de passar outro usuário, autenticação, fuso e limites de mês, ano bissexto, períodos inválidos, mais de mil provas, metadados reais/ausentes/zero, cache sem duplicação, timeout, fallback, revisão, saída inválida e falha da telemetria. A migração foi criada e revertida em SQLite de teste, mantendo as provas existentes.

Os testes de navegador executam o build real com API simulada: entrada pelo menu, teclado e foco, seleção de datas, intensidade das cores, períodos mensal/trimestral/anual, tabela acessível, ausência de rolagem horizontal, erro e nova tentativa, consumo desconhecido, ausência de envio de foto e Voltar/Avançar. Desktop foi exercitado com movimento e as outras larguras com movimento reduzido. As capturas foram inspecionadas visualmente.

Ambiente: Windows, Node 24, PHP 8.3 e Edge headless. O npm foi executado pelo CLI local em `C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`; PHP em `C:/Users/R3/.cache/provaai-tools/php83/php.exe`. Os testes de backend receberam `PYTHON_BINARY` e `NODE_BINARY` locais. Para navegador, `PLAYWRIGHT_MODULE` apontou ao Playwright instalado no runtime e `CHROME_PATH` ao Edge. Nenhuma chamada paga à IA foi feita: respostas dos provedores foram simuladas nos testes.

## Evidências visuais

As capturas usam dados fictícios controlados pelos testes, não métricas de uma conta real.

- [Desktop, 1440 px](2026-11-23-area-professor/painel-1440.png).
- [Tablet, 768 px](2026-11-23-area-professor/painel-768.png).
- [Celular, 375 px](2026-11-23-area-professor/painel-375.png).
- [Celular, 320 px](2026-11-23-area-professor/painel-320.png).

## Publicação e limites

Pronto localmente para revisão e commit pelo usuário. A publicação precisa incluir frontend, backend e a nova migração. O processo existente em `deploy/release.sh` executa `php artisan migrate --force` depois do CI aprovado; commit sozinho não significa que o deploy terminou. Não foi alterado o banco de produção nem publicado este trabalho.

Docker/PostgreSQL da imagem de produção não foi executado neste Windows; a validação correspondente permanece no job de migração do CI já existente. Os testes locais usam SQLite. A integração com provedores reais e os números de uma conta em produção devem ser conferidos após a publicação e a primeira geração. A tela não altera regras de criação de questões, anexos, pesquisa opcional, revisão ou download.
