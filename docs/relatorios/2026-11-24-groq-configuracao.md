# Configuração e validação do Groq

Data: 24/11/2026. Status final: chave autenticada, aplicada à produção e geração/revisão sintéticas aprovadas. As seções iniciais preservam o histórico das tentativas anteriores.

## Configuração na AWS

O usuário inseriu a chave por entrada oculta no EC2 Instance Connect e confirmou a gravação. O arquivo `/opt/provaai-producao/.env.production` é um link para `/etc/provaai/production.env`. A edição foi feita no destino, preservando o link e os demais valores. Foi criado backup privado com permissões 0600 antes da gravação.

## Teste de autenticação

Foi executada uma consulta HTTPS a `https://api.groq.com/openai/v1/models`, usando a chave do arquivo privado no cabeçalho Authorization. O provedor respondeu **HTTP 401 Unauthorized**. Nenhuma credencial foi exibida, gravada no repositório ou transmitida no chat.

A primeira tentativa do comando sofreu interferência da colagem no terminal e não executou; a repetição do comando foi a que retornou 401. Esse resultado é falha de autenticação, não validação de geração ou de revisão. Não comprova a causa específica da rejeição da chave.

O ambiente anterior foi restaurado a partir do backup, depois de comparar as demais configurações para evitar sobrescrever alterações alheias. O terminal confirmou `CONFIGURACAO_ANTERIOR_RESTAURADA`. O contêiner não foi recriado ou reiniciado e a chave rejeitada não foi aplicada ao processo ativo.

## Próxima tentativa preparada

Foi aberta uma nova entrada oculta, com validação de autenticação e disponibilidade de `openai/gpt-oss-120b` antes de permitir a confirmação de gravação. O usuário precisa inserir uma chave ativa e confirmar SIM. Só após isso será possível aplicar o ambiente ao contêiner com a mesma imagem e verificar geração/revisão reais, além da saúde da aplicação.

Não há alteração nova de código nesta etapa. As mudanças locais anteriores continuam sem commit e sem implantação. Os 99 testes/722 verificações do relatório anterior validam a melhoria local de recuperação, não esta chave. `git diff --check` executado para esta documentação. Nenhum staging, commit ou push foi realizado.

## Ajuste da entrada oculta

Após o usuário relatar “formato inválido”, o terminal confirmou que o script rejeitou a entrada antes da chamada à API e sem gravar o ambiente. O valor digitado não foi inspecionado. Marcadores de colagem do terminal já haviam aparecido nos comandos desta sessão; sua presença na chave é uma hipótese, não uma causa comprovada.

A entrada foi ajustada para desativar bracketed paste durante a leitura, remover apenas seus marcadores conhecidos caso presentes, aparar espaços nas bordas e aceitar um par de aspas ou crases envolvendo a chave. Continua rejeitando espaços internos, caracteres de controle e texto adicional. Entradas inválidas agora permitem tentar novamente no mesmo campo oculto, sem retornar ao shell. A autenticação Groq continua obrigatória antes de salvar.

Foram executadas dez verificações locais com valores fictícios no Python existente: chave simples, espaços nas bordas, marcadores ANSI, aspas e crases aceitos; vazio, texto extra, espaço interno e caractere nulo rejeitados. Todas passaram. O terminal foi deixado aguardando a inserção pelo usuário; ainda não há resultado de autenticação para essa nova tentativa. A ferramenta de navegador exige que a entrada e confirmação de novas credenciais sejam feitas pelo usuário.

## Ativação concluída

Após a nova entrada pelo usuário, o terminal confirmou `GROQ_AUTH_HTTP=200`, disponibilidade de `openai/gpt-oss-120b`, confirmação SIM e `CHAVE_SALVA`.

O Compose foi validado sem imprimir valores de ambiente. A primeira consulta, sem `--env-file`, avisou sobre variáveis do PostgreSQL ausentes; nenhuma alteração foi aplicada nessa consulta. A validação foi refeita com `--env-file /etc/provaai/production.env`, sem esses avisos. Confirmados a imagem atual, volume de documentos, porta local 8081 e presença da chave. Antes da recriação havia zero jobs reservados e nenhum cache de configuração Laravel.

Foi recriado somente o serviço `app`, com os arquivos `/opt/provaai-producao/compose.yaml` e `/etc/provaai/compose.production.yaml`, projeto `provaai-producao`, mantendo a imagem `provaai-producao:186f6d00b39e3cbc985b434a11cefc1dd1c15361`. Foram usados `up -d --no-deps --no-build --pull never --force-recreate --timeout 130 app`, com `PROVAAI_IMAGE` obtida do contêiner ativo. Não houve build, atualização de Git, migração, recriação do banco ou implantação das mudanças locais de código.

Após a recriação, Laravel confirmou chave Groq presente e modelo correto. `/up` retornou HTTP 200; documentos, nginx, PHP, fila e agendador estavam RUNNING. O arquivo privado terminou com permissões 0600 e proprietário root:root. A verificação de saúde foi repetida depois dos testes e continuou aprovada.

## Testes reais de geração e revisão

Executados no contêiner de produção, com `AiService::ask`, prompts existentes, `GeneratedExamContent::prepare` e `ExamValidator::validate`. Usada reflexão apenas no processo de diagnóstico para acessar a etapa privada. `AiUsage` foi substituído somente nesse processo por um registrador de status/duração/tokens em stdout, sem persistir telemetria fictícia no banco. Nenhum arquivo da aplicação foi editado e nenhuma prova ou aluno foi criado ou alterado.

| Cenário | Geração | Revisão | Resultado |
| --- | --- | --- | --- |
| Groq direto, duas questões de Ciências/Fotossíntese, sem fontes | HTTP 200, 2,21 s, 1.903 tokens | HTTP 200, 0,50 s, 1.388 tokens | Estrutura válida: uma objetiva e uma discursiva; revisão alinhada, sem tópicos ausentes ou questões fora do assunto. |
| Caminho iniciado no Gemini, material fictício e pesquisa externa desativada | Gemini HTTP 200, 2,53 s | Gemini HTTP 200, 0,69 s | Gemini respondeu nesta tentativa; revisão confirmou apoio nas fontes. Não houve fallback natural. |
| Gemini 503 simulado somente no diagnóstico, Groq real, mesmo modo restrito | Groq HTTP 200, 1,23 s, 1.555 tokens | Groq HTTP 200, 0,49 s, 993 tokens | Troca automática para Groq, estrutura aprovada e revisão com `sourcesGrounded=true` e `offSourceQuestions=[]`. |

O último teste não simulou as respostas do Groq: somente a falha inicial do Gemini foi controlada. A restrição às fontes foi passada tanto à geração quanto à revisão. Os testes utilizaram texto sintético sobre fotossíntese, sem dados de professores/alunos. Eles confirmam autenticação, geração estruturada, revisão e fallback no serviço; não constituem teste completo do navegador/fila/persistência de uma prova real nem medição de turmas grandes.

## Estado entregue e limites

Groq está ativo como reserva do Gemini em produção; não depende de novo commit para essa configuração. A pesquisa externa permanece dependente de Gemini. O teste observado foi rápido, mas não garante esse tempo para qualquer quantidade de questões ou tamanho de anexo. As cotas do plano gratuito continuam se aplicando.

Não foi modificado o código nesta etapa: os testes completos de PHP da alteração local anterior permanecem documentados em `2026-11-24-aws-gemini-recuperacao.md`. Validado o comportamento operacional afetado com as chamadas reais acima e `git diff --check`. Sem staging, commit ou push. As melhorias locais de repetição continuam aguardando o fluxo de commit do usuário.
