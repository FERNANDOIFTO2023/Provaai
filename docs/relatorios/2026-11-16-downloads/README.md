# Diagnóstico da demora nos downloads

Data: 16/11/2026. Código analisado: commit `8873972` (comentários).

Este documento preserva o diagnóstico inicial e suas medições. Após a solicitação de downloads quase imediatos, foram preparadas alterações locais de pré-geração, armazenamento privado e diagnóstico por etapa. A entrega atual, seus testes e requisitos de publicação estão em [IMPLEMENTACAO.md](IMPLEMENTACAO.md). Os números locais deste diagnóstico não representam o site publicado.

## Resultado

**Evidência do site enviada pelo usuário:** a captura da requisição `/api/export/exam` mostra **1,7 minuto esperando a resposta do servidor** e **159,82 ms recebendo o arquivo**. Isso confirma uma espera muito maior que os resultados locais abaixo, que não encerram o diagnóstico de produção.

O principal custo reproduzido localmente foi a inicialização repetida do conversor de PDF. O Laravel inicia um novo processo Node para cada operação. O processo carrega um trabalhador LibreOffice compilado para WebAssembly e encerra ao terminar. A variável `worker` de `scripts/render-document.mjs` só é reutilizada dentro daquele processo, não entre downloads.

O ensaio com o mesmo motor mantido vivo reduziu as conversões posteriores para 79–97 ms. Isso demonstra uma oportunidade de otimização; não é uma medição de produção nem uma garantia de tempo final de download.

Não foi reproduzida uma sessão autenticada do usuário no site e não foram coletadas métricas internas da VM. Portanto, a causa exata da espera mostrada na captura, especialmente se durar muito mais que alguns segundos ou também ocorrer em DOCX, continua dependendo de medição no servidor.

### Verificação adicional do site publicado

Após o relato dos 30 segundos, foram feitas duas consultas GET públicas, sem autenticação ou alteração de dados:

| Rota de `https://provaai.vercel.app` | HTTP | Até receber cabeçalhos | Total |
| --- | ---: | ---: | ---: |
| `/up` | 200 | 578 ms | 589 ms |
| `/api/config` | 200 | 448 ms | 449 ms |

Essas respostas mostram que requisições leves passaram pelo site em menos de um segundo naquele momento. Não medem exportação, acesso autenticado, carga simultânea nem transferência de uma prova. Não descartam demora de banco, espera de trabalhador PHP, conversão lenta na VM ou intermitência.

O acesso a abas do navegador está indisponível neste chat. Não foram encontrados CLI AWS no caminho padrão, configuração/credenciais AWS ou configuração SSH nos caminhos padrão consultados. Não houve tentativa de modificar acesso ao servidor. O usuário forneceu a captura autenticada descrita a seguir; ainda falta correlacionar essa espera com as etapas internas do backend.

### Evidência de produção: aba Timing enviada pelo usuário

Captura de `/api/export/exam` no site `provaai.vercel.app`, com a interface indicando arquivo pronto:

| Etapa exibida pelo Chrome | Duração |
| --- | ---: |
| Queueing | 0,93 ms |
| Stalled | 0,37 ms |
| Request sent | 0,36 ms |
| Waiting for server response | 1,7 min |
| Content download | 159,82 ms |

O valor de 1,7 minuto é arredondado na interface: equivale aproximadamente a 102 segundos, não a uma medição exata de 102.000 ms. Os rótulos “Queued at 3.1 min” e “Started at 3.1 min” indicam posições na gravação, não três minutos de fila.

A demora dessa requisição está quase toda antes do recebimento da resposta, e não na transferência do arquivo ou na fila do navegador. Esse intervalo inclui rede, proxy, espera por atendimento e processamento no backend; a captura não separa essas parcelas. Não permite atribuir os 1,7 minuto especificamente ao conversor, ao banco ou a um bloqueio de cache. O formato escolhido também não está visível na captura.

A revisão do `DocumentService` confirma que há bloqueios com espera máxima de 125 segundos e processos de conversão com timeout de 120 segundos. São limites configurados, não provas de que um deles causou esta demora. O próximo diagnóstico requer tempos por etapa na requisição real (cache, bloqueio, montagem DOCX e conversão PDF), correlacionados com logs e recursos do servidor. A evidência recebida já é suficiente para descartar a transferência do arquivo como componente principal deste caso; não é necessário pedir outra captura idêntica.

## Medições

Foi executado o [benchmark reproduzível](benchmark.mjs) com cinco questões matemáticas fictícias. Foram avaliados modelo padrão, cabeçalho PDF e modelo DOCX, cada um como prova e gabarito, em duas rodadas: **12 montagens DOCX e 12 conversões PDF**. Os formatos foram conferidos pelas assinaturas dos arquivos, sem validação visual completa.

| Etapa | Menor tempo | Mediana | Maior tempo |
| --- | ---: | ---: | ---: |
| Montar DOCX, em processo novo | 294 ms | 350 ms | 396 ms |
| Converter DOCX para PDF, em processo novo | 3.083 ms | 3.446 ms | 3.915 ms |
| Soma das etapas, incluindo cabeçalho quando aplicável | 3.405 ms | 3.927 ms | 4.691 ms |

O recorte da fixture PDF levou 366 e 402 ms, uma vez em cada rodada, e foi reutilizado entre prova e gabarito no ensaio. A coluna de soma inclui esse custo em ambas as variantes para representar a composição de um caminho sem cache de cabeçalho; não é o tempo de uma requisição HTTP real.

Experimento separado com motor persistente e o mesmo DOCX fictício:

- Inicialização: **1.414 ms**.
- Primeira conversão: **1.252 ms**.
- Conversões seguintes: **88 ms, 79 ms e 97 ms**.

A primeira conversão ainda tem custo de preparação interna. A reutilização também mantém bibliotecas e recursos carregados. Não foram medidos documentos grandes, simultaneidade, consumo de memória prolongado ou diferentes arquivos nesse experimento persistente. Os números completos estão em [benchmark.json](benchmark.json).

## O que o código confirma

1. **A exportação acontece durante o pedido de download.** O arquivo pode precisar ser montado antes que qualquer byte seja transferido ao navegador. A IA não é chamada por esse endpoint.
2. **PDF acrescenta uma conversão ao Word.** O `DocumentService` monta ou recupera o DOCX e só então converte para PDF. Isso preserva a diagramação e as equações do documento.
3. **O motor é reiniciado nas conversões sem cache.** A chamada a `new Process` e o `process.exit` encerram qualquer reaproveitamento entre requisições.
4. **O cache de documentos dura 300 segundos.** Arquivos menores que 8 MiB são guardados em base64. Depois desse prazo, ou quando a chave muda, o trabalho é feito novamente. Prova e gabarito têm chaves distintas porque seus conteúdos diferem.
5. **A chave usa o registro inteiro da prova.** Inclui `updated_at` e metadados, além de conteúdo, professor, turma e modelo. Um novo salvamento pode invalidar o cache mesmo sem diferença visual no documento.
6. **O Compose configura cache em banco.** Leituras, escritas e bloqueios de exportação passam por esse armazenamento. Não foi medida sua latência em produção; não é possível atribuir a ele o atraso observado.
7. **Lotes são sequenciais.** `downloadExams` aguarda cada arquivo antes de pedir o próximo; os custos se somam até a montagem do ZIP. Paralelizar sem limitar o número de conversores pode piorar CPU e memória.
8. **Os bloqueios podem acrescentar espera.** O cache protege conversões da mesma chave, mas requisições podem esperar um trabalho já em curso. Essa espera não foi reproduzida neste ensaio.

Referências locais: `app/Services/DocumentService.php`, `app/Http/Controllers/DocumentsController.php`, `scripts/render-document.mjs`, `lib/download-file.ts`, `lib/export.ts` e `compose.yaml`.

## Interpretação da captura em 25%

Para um PDF individual, a interface divide o progresso em quatro etapas. O estado `approved` exibido como “Montando o documento” corresponde ao primeiro quarto. **Não significa que 25% do arquivo foi baixado nem que resta um tempo proporcional.**

Esse estado é registrado antes de consultar os caches e montar o documento. Pode abranger acesso a banco, espera de bloqueio, leitura/recorte de modelo e montagem de Word. O servidor só publica `layout` depois que o DOCX está disponível. A consulta de progresso é periódica e também pode atrasar.

Assim, uma espera longa especificamente em 25% não prova que a conversão PDF está em execução naquele momento. A inicialização do motor explica um custo reproduzido do fluxo completo; o tempo do estágio mostrado precisa de rastreamento real.

O usuário informou que ainda não comparou os formatos. Para diferenciar os casos em produção, a comparação útil é DOCX versus PDF da mesma prova, primeiro pedido versus repetição imediata, e prova versus gabarito. Não foi solicitado o envio de arquivos de alunos a terceiros.

## Alternativas

| Alternativa | Benefício esperado | Limite e custo operacional |
| --- | --- | --- |
| Reutilizar o conversor atual em processo persistente privado | Remove a inicialização repetida mantendo a biblioteca existente; o ensaio mostrou potencial | Exige fila limitada, limpeza entre trabalhos, timeout, reinício após falha e reciclagem por memória. Não basta trocar uma variável no PHP. |
| Gotenberg hospedado na infraestrutura do projeto | API HTTP de conversão baseada em LibreOffice, com gestão do motor e opções de fila | Acrescenta um serviço e consumo de recursos. Fontes, fórmulas, cabeçalhos e paginação devem ser comparados antes da troca. |
| CloudConvert | API gerenciada, conversão DOCX/PDF e SDKs PHP/Laravel | Acrescenta envio/retorno pela rede, cobrança conforme uso e processamento dos documentos por terceiro. Não há benchmark deste projeto demonstrando que será mais rápido. |
| Guardar os arquivos prontos por versão e prepará-los após aprovação | Evita repetir geração e reduz a espera no clique quando a preparação já terminou | Requer invalidação ao editar prova/modelo/turma, armazenamento privado e política de limpeza. A primeira preparação continua tendo custo. |

O Gotenberg documenta conversão Office por API, execução de uma conversão LibreOffice por vez por contêiner, limites de fila e inicialização antecipada do motor. Isso combina com o problema observado, mas não elimina a necessidade de dimensionar o servidor. [API de conversão](https://gotenberg.dev/docs/8.x/convert-with-libreoffice/convert-to-pdf), [operação em produção](https://gotenberg.dev/docs/operate/production).

O CloudConvert documenta motores de conversão Office e LibreOffice e SDKs para PHP/Laravel. A documentação de segurança descreve processamento isolado e exclusão dos arquivos após o processamento. Isso deve ser avaliado junto ao custo e ao tratamento dos dados contidos nas provas. [Documentação da API](https://cloudconvert.com/docs/getting-started/introduction), [segurança e tratamento dos arquivos](https://cloudconvert.com/security).

## Recomendação

Priorizar o reaproveitamento do motor e dos arquivos prontos antes de contratar um conversor externo. Há ganho potencial demonstrado com a biblioteca já instalada. Se for desejável uma API interna pronta, avaliar o Gotenberg em ambiente isolado como candidato, mantendo-o acessível somente ao backend.

Uma implementação deve medir separadamente espera de fila/bloqueio, consulta ao cache, cabeçalho, montagem DOCX, conversão PDF e transferência, usando identificador de pedido e sem registrar conteúdo de alunos. A escolha entre processo persistente atual e Gotenberg deve ser feita com as mesmas provas fictícias, conferência visual e limites de memória/CPU. A observação histórica de uma VM t3.small nos documentos do projeto não confirma seu estado ou seus créditos atuais.

Não é recomendado gerar um PDF simplificado só para ganhar velocidade: o sistema depende de modelos Word, cabeçalhos e equações editáveis. Qualquer substituição deve preservar essas funções.

## Validações e entrega

| Comando | Resultado |
| --- | --- |
| `node docs/relatorios/2026-11-16-downloads/benchmark.mjs` | Concluído: 12 caminhos de exportação e 4 conversões com motor reutilizado; assinaturas de DOCX/PDF válidas. |
| `node --check docs/relatorios/2026-11-16-downloads/benchmark.mjs` | Sintaxe válida. |
| `node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/download-progress.test.ts tests/export-cache.test.ts` | 5 testes aprovados, zero falhas. |
| `php artisan test --filter=DocumentsTest` | 2 testes aprovados, 20 assertions; conversão real e reaproveitamento do Word pelo cache cobertos. |
| Leitura de `benchmark.json` e conferência de 12 amostras | Aprovada. |
| `git diff --check` | Aprovado. |
| Conferência da captura Timing e nova execução de `git diff --check` após atualizar este relatório | Valores transcritos e interpretação revisados; atualização somente documental. |

Node 24.22.1 e PHP 8.3.36 locais. O PHP utilizou `NODE_BINARY` e `PYTHON_BINARY` apenas no ambiente do comando, com o Python isolado já preparado na tarefa anterior. Nenhuma configuração da aplicação foi editada.

Esta entrega contém **diagnóstico, benchmark e relatório**, não uma otimização aplicada. Código de produção, infraestrutura, dependências e dados reais permanecem inalterados. Não houve staging, commit, push, deploy ou contratação de serviço. A suíte completa não foi repetida porque não houve alteração funcional no aplicativo.
