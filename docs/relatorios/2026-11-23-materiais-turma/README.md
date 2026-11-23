# Materiais privados da turma e preparação das referências

Data: 23/11/2026. Alterações locais preparadas para revisão e commit pelo usuário. Não foi feito staging, commit, push, deploy ou alteração no banco de produção.

## Funcionalidade

- Dentro de cada turma, o painel **Conteúdo para as provas → Materiais da turma** recebe PDF, DOC, DOCX, PPT e PPTX. Permite conferir o texto extraído, baixar o original autenticado e remover o material das próximas provas.
- A leitura acontece no envio. Só entram na lista arquivos cuja leitura terminou com sucesso. Falhas não deixam um material parcialmente disponível para a IA.
- Pesquisa externa começa desmarcada. Com materiais e a opção desmarcada, a geração usa os textos anexados, ignora a matéria contida no modelo de diagramação e não chama pesquisa na web. A revisão exige confirmação explícita de apoio nas fontes; resposta negativa ou incompleta preserva o rascunho vazio.
- Ao habilitar a opção, uma chamada separada ao Gemini com `google_search` obtém fontes antes da geração. A interface informa que podem surgir assuntos além dos arquivos e que essa etapa pode aumentar a demora. As fontes consultadas aparecem na revisão da prova.
- O aviso sobre PowerPoint informa que animações avançadas, vídeos e elementos visuais complexos podem causar falhas de leitura ou de geração.
- Turmas sem materiais mantêm o fluxo anterior. As fontes e a preferência são congeladas ao preparar o rascunho/lote. Alterações posteriores não mudam provas já preparadas, inclusive tentativas de geração de rascunhos antigos.

## Rapidez: o que foi otimizado e o que foi medido

O lote consulta o texto pronto uma vez e compartilha essa versão entre os seus rascunhos. A geração não abre nem converte os arquivos. DOCX e PPTX são lidos diretamente; só o PPT antigo precisa passar pelo LibreOffice no envio. Não há nova dependência de conversão ou nova API para ler anexos.

O cache opcional de pesquisa dura 15 minutos e é separado por professor, turma, matéria e tópicos. Guarda resumo e fontes, **nunca questões nem provas de outros alunos**. A geração continua fazendo chamadas novas e mantém as validações de repetição, conteúdo, estrutura e matemática. A leitura do material não elimina a revisão da prova.

Medições locais, com documentos sintéticos pequenos e SQLite em memória:

| Operação | Resultado observado |
| --- | --- |
| Preparar 30 rascunhos com aproximadamente 51 mil caracteres de referência | 48,7 ms na última execução; uma consulta aos materiais e zero conversões |
| Ler DOC real pelo CLI em execução isolada | 202 ms |
| Ler PPTX real pelo CLI em execução isolada | 161 ms |
| Converter/ler PPT real pelo CLI em execução isolada | 3.719 ms |

A execução paralela da suíte completa registrou 538/498/6.234 ms para DOC/PPTX/PPT, respectivamente. Isso mostra a influência da carga local. Esses números **não são o tempo de uma prova pronta**, não incluem resposta real da IA e não são um comparativo antes/depois do site publicado. O trabalho repetido de extração foi eliminado do caminho da geração; não é possível assegurar que o tempo total será menor em todos os pedidos. Anexos longos também aumentam o contexto enviado ao provedor. A latência real precisa ser medida após publicação, com os registros `ai_stage` já existentes e a experiência do navegador.

## Segurança e integridade

- Todas as rotas exigem sessão, propriedade da turma e vínculo do material à turma. Outro professor recebe 404, inclusive ao tentar listar, baixar, enviar, alterar a preferência ou remover.
- Arquivos ficam no disco privado. Caminhos físicos não são serializados; downloads usam `private, no-store` e `nosniff`.
- Os textos completos dos rascunhos ficam ocultos na serialização normal de provas. A tela de materiais só os entrega ao proprietário autenticado.
- O cliente não consegue forjar `source_snapshot`; o servidor monta a versão autorizada. A cópia compartilhada de uma turma não leva os anexos nem concede acesso aos originais.
- Remover material ou excluir a turma limpa os originais após confirmar a transação. Arquivar a turma impede alterações e conserva os materiais para eventual reativação.
- Limites: cinco arquivos, 20 MB por arquivo, 60 mil caracteres somados, até 150 páginas PDF ou 150 slides. Há limites de entradas e expansão ZIP/XML; documentos com macros identificadas e XML com DTD/entidades são recusados. Nenhum comando, animação, macro ou URL do arquivo é executado.
- O prompt trata anexos e pesquisa como dados, não como comandos. Na pesquisa web são enviados matéria e tópicos; anexos e perfis de alunos não são enviados à etapa de busca. O texto dos anexos é enviado ao provedor na geração e na revisão, conforme a função solicitada.
- A aplicação exige fontes HTTPS na resposta da pesquisa e não prossegue silenciosamente sem elas. As sugestões HTML do Google são exibidas em iframe isolado, sem scripts.

## Testes executados sobre a implementação final

| Comando/verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado, sem erros TypeScript |
| `npm test` | **61 testes aprovados**; inclui sete cenários do leitor de materiais e conversões reais |
| `npm run build` | Aprovado |
| `php artisan test --no-ansi` | **83 testes, 615 asserções, todos aprovados**; 20,14 s na última execução |
| `node --experimental-strip-types tests/browser/class-materials.mjs` | Aprovado em 1440 e 375 px |
| `node tests/browser/workspace-navigation.mjs` | **17 cenários aprovados** |
| `node --experimental-strip-types tests/browser/student-import.mjs` | Aprovado em 1440 e 375 px |
| Migração completa, `down()` e `up()` da nova migração em SQLite isolado em memória | Aprovado; tabelas antigas preservadas |
| `git diff --check` | Aprovado |

Os testes novos cobrem: PDF/DOCX reais pela rota HTTP; DOC/PPTX/PPT reais pelo CLI; ordem reorganizada dos slides; arquivos inválidos, vazios, macros, DTD e excesso de texto; limpeza após falhas e exclusões; limite agregado; isolamento entre professores; congelamento das fontes; adulteração de dados do cliente; geração restrita sem pesquisa nem conversão; revisão ausente/negativa; fallback para Groq com a mesma restrição; rejeição de enunciado repetido; pesquisa externa com ferramenta real no contrato HTTP, cache e recusa de resposta sem fontes.

No navegador foram conferidos: acesso dentro de turma existente, upload, bloqueio de preparação durante envio, prévia, download, preferência e recarga, aviso externo, erro de upload, remoção, turma arquivada e ausência de rolagem horizontal. Não houve exceções JavaScript. As requisições de IA e as APIs dos testes de interface foram simuladas; as extrações dos formatos foram reais. A suíte anterior de geração, downloads, matemática, navegação e importação continuou aprovada.

Ambiente: Node 24.22.1, PHP 8.3 e Edge em perfil isolado. Foram usados os executáveis locais já disponíveis, sem editar `.env`: npm em `C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`, PHP em `C:/Users/R3/.cache/provaai-tools/php83/php.exe`, `NODE_BINARY` apontando para o Node do PATH e `PYTHON_BINARY` para `C:/Users/R3/.cache/provaai-tools/math-docs-venv/Scripts/python.exe`. Playwright foi carregado do runtime local do Codex, com `CHROME_PATH` apontando para o Edge. Nenhuma credencial consta neste relatório.

Capturas: [computador](materiais-1440.png) e [celular](materiais-375.png).

## Avisos e limites

- O build mantém aviso de chunk principal acima de 500 kB. Os testes PDF existentes emitem avisos de fontes/estrutura em cenários específicos, sem falhas.
- Só texto é interpretado. Não há OCR nem interpretação de imagens, vídeos ou animações. Páginas PDF sem texto suficiente e slides sem texto são recusados; gráficos ou outros elementos visuais em páginas com texto podem não estar representados na extração. O professor deve conferir a prévia.
- A restrição pedagógica usa instruções e revisão por IA; não constitui prova formal de que cada informação está correta. Continua necessária a revisão e aprovação do professor. Os testes validam o bloqueio e o contrato das chamadas, não a precisão de uma resposta real do provedor.
- Não houve chamada paga ao Gemini/Groq, medição da fila em produção nem publicação. A pesquisa externa depende de chave/modelo Gemini com suporte à ferramenta e disponibilidade/cota do provedor.
- Remover um anexo impede seu uso em novas provas; o texto permanece nas versões das provas já preparadas enquanto elas existirem. Essa regra é informada no painel.

## Para publicar após a revisão e o commit do usuário

Aplicar a nova migração com `php artisan migrate --force`, publicar o build e reiniciar os trabalhadores com `php artisan queue:restart`, seguindo o procedimento existente do projeto. Não usar `migrate:fresh`. O disco privado precisa ser persistente e compartilhado conforme a arquitetura atual. Manter Node disponível e os limites PHP já documentados (`upload_max_filesize=20M`, `post_max_size=21M`). Não há chave nova obrigatória para o modo restrito aos anexos.

Após a publicação, conferir upload e geração com uma turma de teste, opção externa desligada/ligada, e medir o tempo até a prova estar pronta. O código local está validado; a atualização do site e essa medição real permanecem pendentes da publicação.

## Arquivos centrais

- `components/class-materials.tsx`: painel, upload, preferência e prévia.
- `app/Http/Controllers/ClassMaterialsController.php`: autorização e ciclo de vida privado dos arquivos.
- `scripts/class-material.mjs`: leitores e limites de segurança.
- `app/Services/ClassSources.php`: captura dos textos prontos por lote/rascunho.
- `app/Services/AiService.php` e `resources/prompts/`: geração e revisão restritas.
- `app/Services/ExternalResearch.php`: pesquisa opcional e cache de fontes.
- `database/migrations/2026_11_23_150000_add_class_materials.php`: estrutura nova, com padrão seguro e compatibilidade com provas anteriores.

Referência técnica da pesquisa: [documentação oficial de grounding com Google Search](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/grounding-with-google-search). A consulta é separada da geração estruturada de questões, preservando o contrato JSON já usado no projeto.
