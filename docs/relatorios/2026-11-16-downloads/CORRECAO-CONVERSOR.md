# Correção do travamento na inicialização do conversor PDF

Data: 16/11/2026. Código local, sem staging, commit, push ou publicação.

## Evidência e causa

A falha anterior foi HTTP 422 após 120 segundos no processo de conversão PDF. Foram feitos ensaios com uma prova fictícia e o mesmo cabeçalho da fixture, separando carregamento WASM, inicialização LibreOfficeKit, leitura do documento, conversão e encerramento.

O travamento foi reproduzido antes de carregar a prova: o progresso parou em `initializing:60`, dentro da chamada a `libreofficekit_hook()`. Houve uma ocorrência tanto usando WorkerConverter quanto executando diretamente a API. O CLI original também travou antes de `init-done`. Portanto, retirar apenas o wrapper WorkerConverter não resolve o problema.

No pacote instalado `@matbee/libreoffice-converter` 2.7.2, o loader resolve `onRuntimeInitialized` e permite que o runtime execute automaticamente `callMain`, encaminhado a `__emscripten_proxy_main`. Ao mesmo tempo, a API inicializa o LibreOffice via `libreofficekit_hook()`. O aplicativo precisa somente da entrada pela biblioteca. O conflito entre essas inicializações é a explicação sustentada pela inspeção e pelo ensaio comparativo: desativar o início automático retirou os travamentos observados. Não foi feita depuração das pilhas C++ dentro do binário WASM.

## Correção aplicada

`scripts/office-converter.mjs` cria o motor pela API `createConverter` e fornece um loader com `noInitialRun: true`. Essa opção impede a chamada automática a `main()`, conforme a [documentação do Emscripten](https://emscripten.org/docs/api_reference/module.html#Module.noInitialRun). A inicialização e a conversão continuam sendo feitas por LibreOfficeKit.

`scripts/render-document.mjs` usa esse helper no subprocesso Node que já é isolado pelo PHP. O wrapper WorkerConverter não expõe a configuração necessária do loader. O limite externo de 120 segundos e a saída JSON foram preservados. Não foram adicionadas retentativas automáticas, reduzidos timeouts de produção, alteradas dependências nem editados arquivos de `node_modules`.

O subprocesso termina depois de gravar o resultado, como antes. O uso direto não coloca processamento WASM no navegador ou no processo PHP. Não há persistência do documento entre pedidos nem geração de perguntas por esse conversor.

## Ensaios reproduzíveis

O script `converter-probe.mjs` cria temporários exclusivos e uma cópia instrumentada do worker sem modificar dependências. O limite de investigação é de 20 segundos: uma ocorrência marcada `timedOut` significa que o processo não progrediu/concluiu nesse prazo, e não uma nova medição exata de 120 segundos. Os arquivos JSON conservam as etapas e os tempos.

| Caminho | Execuções | Concluídas | Travadas no limite do ensaio |
| --- | ---: | ---: | ---: |
| WorkerConverter padrão | 12 | 11 | 1 |
| API direta com loader padrão | 12 | 11 | 1 |
| CLI anterior à correção | 20 | 19 | 1 |
| API direta com `noInitialRun` | 20 | 20 | 0 |
| CLI corrigido | 20 | 20 | 0 |

No CLI corrigido, os tempos locais foram **2,893–4,767 segundos**, mediana **3,217 segundos**, incluindo inicialização, conversão e saída. São conversões sem cache, não o tempo de download no site. A preparação antecipada da tarefa anterior permite evitar esse processamento no clique quando o arquivo já existe.

Os ensaios Worker/direto e CLI antigo tiveram parte das execuções sobreposta, chegando a dois processos simultâneos; a comparação não é um benchmark de desempenho sob carga controlada. O desaparecimento da falha em 40 execuções corrigidas é evidência local, não garantia absoluta para todos os documentos, máquinas ou cargas.

Evidências: `converter-probe-worker-direct.json`, `converter-probe-cli.json`, `converter-probe-library.json`, `converter-probe-fixed.json`. O arquivo `cli.json` é histórico da versão anterior; executar o modo `cli` no checkout atual mede a versão atual. Para repetir a correção sem substituir o histórico antigo:

```sh
node --experimental-strip-types docs/relatorios/2026-11-16-downloads/converter-probe.mjs 20 fixed
node --experimental-strip-types --test tests/office-converter.test.mjs
```

## Regressões e preservação das provas únicas

- O teste de inicialização usa o motor real e verifica `noInitialRun: true` e `isReady()`. Remover a configuração faz essa garantia falhar mesmo se a corrida não se manifestar naquela execução.
- Quatro conversões reais pelo CLI verificam duas provas diferentes, cada uma como prova e gabarito. O PDF é aberto com PDF.js, seu texto é extraído e o cabeçalho em imagem é conferido. O gabarito reservado só aparece no documento docente; a pergunta de uma prova não aparece na outra.
- O teste PHP adicional confirma que provas diferentes não compartilham arquivos, mesmo com os mesmos metadados e até numa colisão artificial de conteúdo da fixture. O ID da prova faz parte da chave. Essa colisão é criada diretamente no banco de teste e não flexibiliza as validações da API.
- As regras de geração e verificação de perguntas repetidas não foram alteradas. Reutilizar um arquivo pronto significa baixar novamente a mesma prova/versionamento, não copiar questões de outra prova. Estes testes verificam isolamento de arquivos; não afirmam unicidade semântica universal dos enunciados gerados pela IA.

## Validação final

| Comando | Resultado |
| --- | --- |
| `node --experimental-strip-types --test tests/office-converter.test.mjs` | 2 testes aprovados; motor real e quatro PDFs conferidos. |
| `php artisan test` | 56 testes, 399 assertions, sem falhas; 38,60 s. |
| `npm test` | 54 testes aprovados, sem falhas; 36,60 s. |
| `npm run typecheck` | Aprovado. |
| `npm run build` | Aprovado; 730 módulos. |
| `node --check` nos scripts/teste novos e alterados | Aprovado. |
| `git diff --check` e verificação dos arquivos novos | Sem problemas de whitespace. |

As suítes PHP/JS finais rodaram em paralelo, com conversões reais simultâneas, sem repetir a falha. Os avisos já existentes de bundle acima de 500 kB e de PDF.js (fonte padrão/indexação em outras fixtures) permanecem. Ambiente: Node 24.22.1, PHP 8.3.36, Windows. Os caminhos para executar npm/PHP nesta máquina constam em `IMPLEMENTACAO.md`.

## Biblioteca alternativa e entrega

A correção utiliza a biblioteca já instalada. Gotenberg permanece uma alternativa para hospedar o LibreOffice como serviço interno, com início antecipado, fila limitada e reinício do motor. Esses mecanismos estão na [documentação de produção do Gotenberg](https://gotenberg.dev/docs/operate/production). Não foi instalado, contratado ou integrado nesta tarefa: a falha reproduzida foi tratada sem acrescentar outro serviço. Uma troca exigiria medir recursos e comparar diagramação/fontes com os modelos do projeto.

Pronto para revisão e commit pelo usuário: correção da inicialização e testes de regressão, junto das alterações locais anteriores. Pendente: publicar o backend, iniciar a preparação conforme `IMPLEMENTACAO.md` e confirmar a latência com uma prova de teste no site. Não houve acesso ao servidor nem confirmação de que a espera de 102 segundos em produção tenha exatamente a mesma causa. Docker/Linux e os documentos reais dos usuários não foram testados neste ambiente.
