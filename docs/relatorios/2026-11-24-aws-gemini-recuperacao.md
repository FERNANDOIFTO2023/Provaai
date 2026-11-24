# AWS e recuperação de falhas do Gemini

Data: 24/11/2026. Base local: `186f6d0`. Sem staging, commit ou push.

## Verificação da conexão AWS

O plugin AWS Core continua retornando `UNAUTHORIZED`/reautenticação necessária. A sessão autenticada do navegador permitiu conectar por EC2 Instance Connect à instância existente em us-east-1. Nenhuma regra de segurança adicional foi necessária nesta execução.

O contêiner `provaai-producao-app-1` está em execução com imagem `provaai-producao:186f6d00b39e3cbc985b434a11cefc1dd1c15361`. O runtime informa provedor Gemini, modelo `gemini-3.5-flash-lite`, chave Gemini presente e chave Groq ausente. Não foram exibidas credenciais nem alterados ambiente, contêineres ou banco de produção.

## Verificação da geração real

Os seis eventos recentes consultados tinham status HTTP 503 na geração. Três eram de 24/11, às 13:49:18, 13:49:21 e 13:49:25 conforme os valores registrados no banco, com durações de 1.351, 2.766 e 4.062 ms. Não houve conversão desses horários para o fuso local.

A consulta ao catálogo Gemini retornou modelos disponíveis para `generateContent`. Foram feitas chamadas sintéticas diretamente do contêiner, usando o prompt de geração e o esquema JSON do projeto: duas questões de Química, uma objetiva e uma discursiva, sem anexos ou dados de alunos. Nenhuma prova de professor foi criada ou alterada.

| Modelo | Resultado real |
| --- | --- |
| `gemini-3.5-flash-lite` | HTTP 503 em 24,65 s; `UNAVAILABLE`, mensagem explícita de alta demanda. |
| `gemini-3.1-flash-lite` | HTTP 503 em 0,38 s; mesma indicação de alta demanda. |
| `gemini-3.5-flash` | Exceção capturada após 30,03 s, sem resposta HTTP observada; limite da sondagem de 30 s. |

A terceira sondagem capturou uma exceção genérica sem expor sua mensagem; sua duração é compatível com timeout, mas não houve classificação detalhada da exceção. Uma tentativa adicional de chamada simples foi prejudicada pela colagem no terminal e resultou em erro de sintaxe, portanto não serve como teste da API. A inspeção do contêiner foi repetida isoladamente e confirmou seu estado.

O retorno HTTP do provedor confirma comunicação da AWS com o Gemini; as falhas 503 observadas não são falhas de login SSH. A reprodução sem anexos demonstra que referências não são necessárias para desencadear o problema. Não demonstra que tamanho de contexto seja irrelevante para latência ou disponibilidade. Os testes reais não produziram uma prova completa; a geração em produção continua pendente de recuperação do provedor ou configuração de uma reserva funcional.

## Correção preparada no código

- `GeminiRetry` compartilha o orçamento de tempo entre até três tentativas. Repete HTTP 408/500/502/503/504 e falhas de conexão, com espera progressiva de 1 e 2 segundos acrescida de variação de até 250 ms. Respeita `Retry-After` quando recebido e encerra se não houver tempo para nova chamada.
- O relógio monotônico evita que ajustes no relógio do sistema prolonguem a etapa. Os prazos já definidos para geração, revisão e pesquisa não foram aumentados.
- Remove a limitação antiga que só repetia 5xx recebidos antes de dois segundos, após espera de apenas 300 ms. Falhas mais demoradas agora podem se recuperar dentro do tempo restante.
- Com Groq configurado, geração e revisão mantêm troca direta para a reserva, sem aguardar as novas repetições Gemini.
- Pesquisa externa também recebe recuperação transitória, dentro dos seus dez segundos. Continua exigindo fontes verificáveis e não ignora a autorização de pesquisa.
- Cota, autenticação, resposta inválida e recusa de conteúdo não recebem repetição automática por esta classe.
- Cada tentativa continua contabilizada em `AiUsage`. Logs de repetição incluem apenas etapa, número, status e espera; não incluem prompts ou chaves.
- A repetição da revisão usa as questões da mesma geração em andamento. Não busca questões de outras provas. Permanecem os controles existentes de duplicação, privacidade, apoio nos anexos e revisão antes do salvamento.

Referência consultada: [estratégia de repetição do Gemini](https://aistudio.google.com/docs/troubleshooting). A política mantém o tratamento de cota existente do projeto, sem repetir 429.

## Testes e resultados

Ambiente local: PHP 8.3 em `C:/Users/R3/.cache/provaai-tools/php83/php.exe`, `NODE_BINARY` apontando ao Node do PATH e `PYTHON_BINARY` para `C:/Users/R3/.cache/provaai-tools/math-docs-venv/Scripts/python.exe`. Nenhuma credencial foi necessária para a suíte.

1. `php artisan test --no-ansi --filter='GeminiRetryTest|AiTest|ClassMaterialsTest|TeacherDashboardTest'`: 35 testes aprovados, 240 verificações, 11,18 s, antes da adição do último caso de pesquisa externa.
2. `php artisan test --no-ansi`, sobre a implementação e testes finais: **99 testes aprovados, 722 verificações, 38,23 s**.
3. `git diff --check`: sem erros de whitespace; Git avisou sobre normalização LF/CRLF em arquivos editados.

Regressões acrescentadas: 503 com duração superior a dois segundos, limite de três tentativas, prazo compartilhado, `Retry-After`, recuperação de conexão, reserva sem espera, pesquisa recuperada sem duplicar consumo por cache e duas falhas consecutivas na revisão com preservação dos anexos e das mesmas questões. A suíte completa também verificou importação, isolamento entre professores, documentos e verificações matemáticas existentes.

As respostas de IA na suíte são simuladas; os testes locais não provam disponibilidade da API real. Não houve mudança no frontend ou no verificador matemático.

## Pronto e pendente

A melhoria de recuperação está validada localmente e disponível para revisão e commit do usuário. Ainda não está no servidor. O relatório anterior de diagnóstico foi preservado como registro da investigação anterior.

Para reduzir dependência da indisponibilidade Gemini, é necessário configurar uma chave Groq válida no ambiente privado de produção e validar geração/revisão reais. Não se deve enviar a chave no chat. Um commit não cria essa credencial; a atualização do ambiente precisa chegar ao contêiner e ao worker. A pesquisa externa continua dependente de Gemini mesmo quando há reserva Groq para geração/revisão.

A recuperação com espera ajuda em falhas transitórias, mas não garante sucesso durante uma indisponibilidade persistente. Não foi trocado o modelo de produção porque nenhuma alternativa testada concluiu a geração.
