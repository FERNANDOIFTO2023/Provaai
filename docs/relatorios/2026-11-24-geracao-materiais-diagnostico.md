# Falhas de geração após materiais de referência

Data: 24/11/2026. Investigação do código no commit `186f6d0` e comparação com a introdução dos materiais em `926ea46`. Sem alteração de implementação, credenciais ou produção.

## O que a mensagem permite concluir

A mensagem “O Gemini está temporariamente indisponível” é emitida em `AiService::ask` para HTTP 408, 500, 502, 503 ou 504. Não é a mensagem usada para recusa de conteúdo fora dos anexos, erro de leitura de arquivo ou falha da pesquisa externa. Pode acontecer na geração ou na revisão. A imagem não informa o status HTTP ou a etapa exata desta tentativa.

Na inspeção anterior da AWS, seis dos oito últimos eventos eram HTTP 503 na geração e uma revisão terminou sem resposta HTTP em aproximadamente 25 segundos. A produção estava sem `GROQ_API_KEY`. Em seguida, uma chamada sintética de geração com o prompt e o esquema do projeto, sem anexos, também retornou HTTP 503 em 0,95 segundo, com `UNAVAILABLE` e indicação de alta demanda do modelo. Essa reprodução afasta a hipótese de que anexos sejam necessários para provocar a falha. Não comprova o estado atual do servidor.

A tentativa atual de consultar a AWS pelo conector retornou `UNAUTHORIZED`, com exigência de reautenticação. Não foi possível atualizar os logs, conferir a chave de reserva ou medir a tentativa da captura. Não foram exibidos segredos.

## O que mudou com os materiais

| Situação | Chamadas previstas quando as etapas anteriores têm sucesso |
| --- | --- |
| Sem materiais | Geração e revisão: duas chamadas por prova. Não chama pesquisa externa, mesmo que a preferência da turma esteja ativada. |
| Com materiais e pesquisa desativada | Duas chamadas por prova, ambas contendo os textos dos materiais; revisão exige apoio nas fontes. |
| Com materiais e pesquisa ativada | Pesquisa externa antes da geração, depois geração e revisão. A pesquisa pode ser atendida pelo cache de 15 minutos por conta/turma/matéria/tópicos. |

- O texto é extraído no envio, sem converter os arquivos novamente durante a geração. Isso economiza leitura/conversão, mas não elimina o envio e o processamento do contexto pelo provedor.
- O limite dos materiais é de 60.000 caracteres por turma. Esse conjunto pode ser enviado na geração e na revisão de cada aluno. Em duas provas, se as quatro etapas forem alcançadas, são até 240.000 caracteres de materiais distribuídos entre chamadas, além das instruções e questões. Caracteres não equivalem a tokens; não é uma única requisição de 240.000 caracteres.
- A pesquisa acrescenta até 12.000 caracteres de resultado ao contexto. No modo externo, a referência textual do modelo Word também pode permanecer na geração. No modo restrito aos materiais, essa referência é removida para não introduzir conteúdo de outra fonte.
- Com pesquisa externa habilitada e sem reserva configurada, os limites Gemini passam de 90/25 segundos para 75/20 segundos na geração/revisão; a pesquisa tem até 10 segundos. Isso pode aumentar a exposição a timeout em contextos longos, mas timeout de conexão tem mensagem diferente da captura.
- Sem materiais, o caminho original continua, com instruções adicionais condicionais sobre fontes. A mudança não acrescenta chamadas de pesquisa nesse caso.

O volume maior e a etapa externa são fatores plausíveis de demora e exposição a falhas. Não há comparação controlada antes/depois que demonstre que causaram aumento da taxa de HTTP 503. O erro de alta demanda confirmado veio do provedor, inclusive sem materiais.

## Fragilidades de recuperação encontradas

- Sem Groq, há somente uma repetição após 300 ms, apenas para HTTP 500/502/503/504 que cheguem em menos de dois segundos. Uma falha após esse intervalo não recebe essa repetição.
- A documentação oficial recomenda espera progressiva com variação aleatória e número limitado de tentativas para erros transitórios. Referência: [Gemini - estratégia de repetição](https://aistudio.google.com/docs/troubleshooting#retry-strategy).
- O job tem uma tentativa e timeout de 125 segundos. Ao falhar, registra o erro e avança para a próxima prova; o lote não tem reagendamento espaçado dessa falha transitória. A mesma indisponibilidade pode atingir as duas provas consecutivas.
- A reserva Groq depende de chave válida carregada no processo. O fallback preserva os materiais e o modo restrito, mas a pesquisa externa usa Gemini e não tem reserva equivalente.
- Questões só são salvas depois da revisão. Uma geração bem-sucedida seguida de falha de revisão pode aparecer como zero provas geradas; repetir esse rascunho reexecuta a geração. Isso não é reutilização de questões de outras provas.
- Os rascunhos congelam `source_snapshot`. Mudar materiais ou pesquisa na turma não altera rascunhos já preparados. Para testar uma nova configuração, é necessário preparar outro rascunho.

## Como reduzir o problema

1. Reautenticar o conector AWS e conferir os eventos recentes por etapa, status, duração e tokens disponíveis, sem registrar conteúdo dos anexos. Separar falhas do provedor de timeout e rejeição pedagógica.
2. Configurar e testar a chave de reserva no ambiente privado de produção, caso continue ausente. Aplicar o ambiente ao contêiner/worker; um commit sozinho não configura a credencial. Testar também geração e revisão com materiais restritos.
3. Para uso imediato, preparar um novo rascunho com somente os materiais pertinentes ao tópico e pesquisa externa desativada quando dispensável. Se precisar testar contexto reduzido, usar uma turma de teste própria sem remover os materiais originais. Essas medidas reduzem carga, mas não garantem superar sobrecarga do provedor.
4. Melhorar repetição de falhas transitórias com espera progressiva e orçamento total. Respeitar timeout do job, reservas e idempotência; não empilhar tentativas longas que ultrapassem os 125 segundos existentes.
5. Avaliar seleção de trechos pertinentes dos materiais, com referências e testes de cobertura, sem cortar silenciosamente conteúdo necessário ou relaxar a exigência de apoio nas fontes. Manter novas questões por prova e revisão docente.

Não se recomenda desligar a revisão, aceitar questões fora dos anexos no modo restrito, reutilizar provas de outros alunos ou apenas elevar todos os timeouts.

## Validação

Comparação Git, inspeção de `AiService`, `ExternalResearch`, `ClassSources`, `BatchService`, `GenerateBatchStep`, limites de upload e testes existentes. A suíte direcionada `php artisan test --filter='AiTest|ClassMaterialsTest|TeacherDashboardTest' --no-ansi` concluiu com **28 testes aprovados e 200 verificações**, duração informada de 46,37 segundos. PHP 8.3 local, `NODE_BINARY` apontando ao Node do PATH e `PYTHON_BINARY` ao ambiente de matemática existente, sem editar o ambiente da aplicação. Respostas dos provedores são simuladas nessa suíte e não confirmam saúde da API real.

Os cenários conferem geração com e sem fontes, pesquisa separada e cache, preservação das fontes ao retomar, fallback com restrições e rejeição de enunciados repetidos. `git diff --check` executado para a entrega; não houve mudanças de código que exigissem build ou publicação.

Nenhuma correção foi aplicada ou publicada nesta investigação. O diagnóstico identifica as limitações e os próximos passos; a falha atual de produção não foi declarada resolvida. Sem staging, commit ou push.
