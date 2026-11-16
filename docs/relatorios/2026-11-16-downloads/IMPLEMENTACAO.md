# Downloads preparados após a aprovação

Data: 16/11/2026. Alterações locais sobre `8873972`, sem staging, commit, push ou deploy.

Atualização: a pendência de inicialização do conversor foi reproduzida e corrigida localmente em uma etapa posterior. Veja [CORRECAO-CONVERSOR.md](CORRECAO-CONVERSOR.md) para a causa, evidências e resultados finais (56 testes PHP e 54 JS). As falhas abaixo são o histórico anterior à correção.

## Problema e resultado esperado

A captura do site mostrou cerca de 1,7 minuto esperando a resposta e 159,82 ms recebendo o arquivo. A causa exata desse tempo em produção ainda não foi isolada. A mudança antecipa o trabalho de exportação para que o clique possa entregar um arquivo já pronto, sem montar Word nem converter PDF naquele momento.

O caminho rápido foi validado em testes: depois da preparação, as quatro combinações (prova/gabarito, PDF/DOCX) são servidas com o conversor explicitamente proibido pelo teste. Isso confirma ausência de reconversão; **não é uma medição de latência de produção nem uma promessa de download instantâneo**.

## Alterações

- A transição de rascunho para aprovado na API agenda dois trabalhos, um para prova e outro para gabarito, somente após confirmar a transação. Aprovar novamente sem mudar o estado não duplica esses trabalhos. Rollback não deixa tarefas pendentes.
- Cada trabalho prepara o PDF e seu DOCX de origem. Antes de executar, busca a prova atual e verifica se continua aprovada e vinculada à conta. Trabalhos de registros excluídos, em revisão ou de outra conta são ignorados.
- Os arquivos ficam no disco privado `local`, em `export-artifacts`, dentro do volume de documentos já existente. A gravação em temporário seguida de substituição atômica impede leituras parciais. Os downloads continuam passando pela autorização do Laravel; não foi criada URL pública para os arquivos.
- O cache dos documentos prontos passa de cinco minutos no banco, em base64 e com limite de 8 MiB, para sete dias em arquivos privados. O cabeçalho PDF continua usando o cache anterior. O cache quente evita consultas de bytes/bloqueios no banco, mas ainda consulta autorização, turma e modelo.
- A versão considera os dados da prova e da conta, nome do professor, turma, variante, arquivo do modelo e proporção do cabeçalho. Apenas `created_at` e `updated_at` são retirados da chave porque não são usados no documento. Alterações relevantes geram outra chave; as versões antigas ficam inacessíveis pelo endpoint e são removidas após expirar.
- O comando diário `provaai:cleanup-downloads` remove somente artefatos vencidos da pasta exclusiva. Não apaga modelos enviados. A publicação e a limpeza usam o mesmo bloqueio curto por arquivo, evitando excluir uma substituição recém-gravada.
- O trabalhador `documents` usa uma conexão de fila própria, nas tabelas já existentes. O Supervisor inicia um processo de preparação por contêiner; o trabalhador de IA permanece separado. O timeout é de 420 s, a reserva de 480 s, uma tentativa, com falha registrada em timeout. As reservas de geração de DOCX/PDF passam a 300/450 s, respectivamente, para cobrir as etapas encadeadas. O tempo máximo para aguardar a reserva continua sendo 125 s.
- A confirmação na interface informa a preparação em segundo plano.

## Diagnóstico disponível após publicar

O POST autenticado `/api/export/exam` devolve `Server-Timing` e `X-Export-Id`. O primeiro usa durações em milissegundos conforme o [padrão Server Timing](https://www.w3.org/TR/server-timing/); o segundo correlaciona a execução com o log `document_export_timing`. A preparação produz `document_export_prepared`.

Os logs adicionados contêm apenas ID aleatório da execução, status/sucesso, durações e estados de cache. Não registram nome de aluno, conteúdo, cookies, caminhos de arquivo ou identificadores de provas. Uma falha no destino de logs não impede a resposta do download.

| Métrica | Interpretação |
| --- | --- |
| `app_total` | Tempo desde a entrada no middleware, incluindo sessão/autenticação; não inclui bootstrap, espera anterior no PHP-FPM, proxy ou transferência. |
| `authorize` | Validação do pedido, busca da prova e conferência de aprovação. |
| `prepare` | Consulta de turma/modelo e cálculo da versão. |
| `docx_cache_read`, `pdf_cache_read`, `header_cache_read` | Consultas aos respectivos caches; chamadas repetidas são somadas. |
| `*_lock_wait` | Somente aquisição/espera pelo bloqueio, sem incluir a conversão protegida. |
| `header_prepare`, `header_render` | Caminho/hash e processamento do cabeçalho. |
| `docx_render`, `pdf_convert` | Montagem Word e conversão PDF. |
| `*_cache_write`, `*_lock_release`, `progress` | Persistência, liberação e atualização do progresso. |
| `*_cache` | `hit`: pronto; `miss`: precisou preparar; `hit_after_wait`: outro trabalho deixou pronto durante a espera. |

`app_total` engloba as etapas: não deve ser somado a elas. As métricas específicas não cobrem todo o tempo do pedido. Por exemplo, uma grande diferença entre a espera vista no Chrome e `app_total` exige investigar servidor web, capacidade de atendimento, bootstrap e proxies. Não significa automaticamente lentidão de rede.

## Testes

Os cenários novos cobrem aprovação sem conversão síncrona, publicação na fila após commit, rollback, trabalhador real consumindo a fila em banco, quatro variantes sem reconversão, reaproveitamento após seis minutos, separação de gabarito, troca de conteúdo/nome/turma/modelo/recorte, restrição entre contas, reprovação, exclusão, cache corrompido, expiração e limpeza. Há atrasos controlados para conferir a distinção entre conversão e espera por bloqueio, inclusive falhas e timeout.

A fila e o endpoint foram exercitados juntos com conversor determinístico em `PreparedDownloadsTest`. `DocumentsTest` executa a conversão real de PDF/DOCX e o processamento dos modelos. Os testes JS também verificam separação de respostas e preservação das fórmulas/modelos. Não foi feita comparação visual de todos os documentos reais dos usuários.

| Comando | Resultado |
| --- | --- |
| `php artisan test` | Execução final: 55 testes aprovados, 390 assertions, 18,37 s. Houve uma falha intermitente de conversão em execução anterior, descrita abaixo. |
| `npm run typecheck` | Aprovado. |
| `npm test` | 52 testes aprovados, nenhuma falha. |
| `npm run build` | Aprovado, 730 módulos. |
| Parser INI do Python sobre `deploy/supervisord.conf` | Sintaxe, usuário e relação entre prazos conferidos. |
| `php -l` nos 13 arquivos PHP alterados/novos | Sintaxe válida. |
| `git diff --check` e conferência dos arquivos novos com `git diff --no-index --check` | Sem problemas de whitespace. |

Uma execução inicial do teste de timeout falhou porque a simulação parcial do cache tentou acessar um contêiner não inicializado. A simulação foi corrigida; os testes de timeout passaram depois disso. Não foi ocultada nem ignorada falha do aplicativo.

### Falha intermitente localizada durante a validação

Uma execução completa intermediária terminou com 54 testes aprovados e uma falha: `DocumentsTest::test_approved_exam_exports_pdf_and_docx_through_laravel` recebeu HTTP 422 após o processo atingir 120 segundos. O novo diagnóstico registrou:

| Etapa local | Tempo |
| --- | ---: |
| Espera pelo bloqueio PDF | 0,10 ms |
| Cabeçalho | 836,77 ms |
| Montagem DOCX | 441,86 ms |
| Conversão PDF | 120.286,31 ms |
| Total da requisição | 121.577,54 ms |

Isso localiza **essa falha local** no processo de conversão PDF, sem demonstrar que o caso de produção tem a mesma causa. A repetição isolada de `DocumentsTest` passou (2 testes, 23 assertions, 8,27 s), seguida pela execução completa final aprovada. Não houve aumento do timeout nem remoção do teste para obter aprovação. A causa interna da intermitência no motor WASM não foi estabelecida e **não se declara corrigida**. As durações por etapa e os arquivos já preparados permitem diagnosticar a primeira conversão e evitar repeti-la nos downloads seguintes; a robustez do primeiro processamento ainda precisa de acompanhamento.

O build manteve o aviso de bundle acima de 500 kB. Os testes PDF emitiram os avisos já existentes sobre fonte padrão e indexação de objetos; terminaram aprovados.

Ambiente: Node 24.22.1 e PHP 8.3.36. Para reproduzir neste Windows, foram usados:

```powershell
$env:PYTHON_BINARY='C:/Users/R3/.cache/provaai-tools/math-docs-venv/Scripts/python.exe'
$env:NODE_BINARY=(Get-Command node).Source
$env:PATH='C:\Users\R3\.cache\provaai-tools\php83;'+$env:PATH
& C:/Users/R3/.cache/provaai-tools/php83/php.exe artisan test
node C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js run typecheck
node C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js test
node C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js run build
```

O verificador matemático não foi alterado. Seus testes de integração PHP e de fórmulas JS passaram nas suítes acima.

## Ativação e verificação operacional pendentes

A mudança precisa de publicação do **backend**, incluindo a configuração do Supervisor. Publicar apenas o frontend na Vercel não inicia a preparação. Não há migração nova nem nova dependência externa. A imagem deve ser reconstruída pelo fluxo de release existente e usar o volume privado persistente; confira a nova conexão caso haja configuração Laravel em cache.

Após o release, no contêiner correto da aplicação, verificar `supervisorctl status documents`: ele deve estar `RUNNING`. Os comandos abaixo são operacionais, **não foram executados no servidor**. Respeite o arquivo/projeto Compose da instalação existente.

```sh
docker compose exec app supervisorctl status documents
docker compose exec --user www-data app php artisan provaai:prepare-downloads --limit=20
```

O segundo comando agenda as 20 aprovações mais recentes já existentes. Não espera a preparação terminar. O limite aceito é 1–1000; não o execute repetidamente para a mesma seleção sem necessidade. Novas aprovações passam a agendar automaticamente. Fora do Docker, o trabalhador equivalente é:

```sh
php artisan queue:work documents --queue=documents --sleep=1 --tries=1 --timeout=420
```

Comprovar em homologação/produção: aprovar uma prova de teste, observar conclusão da preparação, baixar prova/gabarito em ambos os formatos e verificar `*_cache: hit`, ausência de `pdf_convert`/`docx_render` e o tempo total real no Chrome. Depois editar/reaprovar e conferir o documento atualizado. Se a primeira geração continuar levando muito tempo, usar os tempos por etapa e métricas da VM para decidir entre reutilização do motor, conversor nativo/API ou ajuste de capacidade.

## Limites e decisão de commit

- O clique só evita conversão quando a preparação já terminou e o arquivo não venceu. Um clique imediatamente após aprovar, uma prova antiga ainda não preparada, uma alteração de modelo/turma ou uma preparação que falhou pode seguir pelo caminho síncrono e esperar. A geração lenta não foi magicamente eliminada: foi antecipada para os casos preparados.
- Mudanças de turma/modelo invalidam o arquivo no próximo pedido, mas não disparam preparação em massa de todas as provas vinculadas. Uma nova aprovação ou o comando operacional pode antecipar a geração atualizada.
- CPU, memória, disco e fila continuam precisando de acompanhamento. A preparação acrescenta trabalho mesmo para gabaritos que talvez não sejam baixados. Existe um trabalhador por contêiner, sem limite global entre várias réplicas; descargas simultâneas ainda podem gerar documentos distintos pelo HTTP.
- Sete dias limitam a validade, não o espaço total. O agendador deve estar ativo para apagar versões antigas. Arquivos são persistidos no volume privado local compartilhado com o processo HTTP; uma implantação com workers em outra máquina precisa compartilhar esse armazenamento.
- A imagem Docker e o Supervisor não foram executados nesta máquina: Docker não foi encontrado. O parser da configuração e o trabalhador Laravel foram testados. O acesso autenticado ao site e as métricas internas do servidor continuam indisponíveis neste chat.

Disponível para revisão local: pré-geração, cache privado, diagnóstico, testes, configuração do trabalhador e a correção de inicialização descrita em [CORRECAO-CONVERSOR.md](CORRECAO-CONVERSOR.md). Pendente: decisão de commit, publicação e medição real no site. A verificação local não substitui a confirmação na infraestrutura de produção.
