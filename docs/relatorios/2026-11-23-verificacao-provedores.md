# Verificação de Gemini e Groq

Data: 23/11/2026. As seções iniciais registram a investigação anterior ao acesso à AWS. A atualização ao final contém as verificações reais posteriores, sem alteração de código e sem commit.

## Resultados confirmados

- A integração alternativa é Groq (`api.groq.com`), modelo `openai/gpt-oss-120b`. Não há integração com Grok/xAI neste fluxo.
- A [página oficial de status do Groq](https://groqstatus.com/) informou operação normal na consulta. Isso não confirma credenciais, cota ou conectividade da conta de produção.
- `/api/config` do site respondeu `aiConfigured: true`, `backend: laravel`. Esse indicador verifica presença de configuração; não faz chamada real nem diferencia a disponibilidade de cada chave.
- Não foram encontradas chaves Gemini/Groq configuradas no `.env` local. As credenciais não foram exibidas. A configuração e os logs internos da AWS não estavam acessíveis nesta investigação; não é possível afirmar que a chave Groq de produção esteja presente ou válida.

## Comportamento do código

Com `GROQ_API_KEY` configurada no servidor, erros de conexão/timeout do Gemini e HTTP 401, 403, 404, 408, 429 ou 5xx acionam o Groq para a etapa de geração/revisão. Na geração, o limite de espera do Gemini com reserva é de 35 segundos; na revisão, 10 segundos. A etapa seguinte usa o provedor escolhido pelo fallback. Recusas, respostas truncadas, JSON inválido e HTTP 400 não acionam essa troca.

A pesquisa externa em `ExternalResearch` usa Gemini com Google Search e não tem fallback para Groq. Quando materiais estão anexados e a pesquisa externa está habilitada, uma falha nessa consulta interrompe o fluxo antes da geração. Esse é um possível motivo, ainda não confirmado, para a reserva não ser acionada. A mensagem exata e a configuração da prova foram solicitadas ao usuário para distinguir os casos.

## Testes e limites

`php artisan test --filter='AiTest|TeacherDashboardTest|ClassMaterialsTest' --no-ansi`: **28 testes / 200 verificações aprovados**. Executado com PHP 8.3 e executáveis locais Node/Python configurados. As respostas HTTP são simuladas; os testes validam o código de geração, fallback, restrição aos materiais, revisão e registro de consumo. Não comprovam disponibilidade de uma chave real.

`git diff --check`: aprovado. Nenhuma mudança de implementação exigiu novo build. A página oficial do Gemini não forneceu estado legível pela ferramenta de consulta; não foi atribuída uma causa global à falha relatada. Para concluir o diagnóstico da conta, falta a mensagem do erro e/ou acesso aos logs/configuração de produção sem compartilhar segredos.

## Diagnóstico após a mensagem fornecida pelo usuário

O usuário informou: “0 de 1 prova(s) gerada(s). O Gemini está temporariamente indisponível. Tente novamente neste rascunho em alguns instantes.” A tentativa foi feita sem materiais na turma, com a pesquisa externa ativada e desativada.

No código atual, essa mensagem corresponde a HTTP 408, 500, 502, 503 ou 504 do Gemini. Antes de lançar essa mensagem, `AiService::ask` encaminha esses mesmos erros ao Groq se `config('provaai.groq_key')` estiver preenchida. Portanto, a mensagem indica que **o processo daquela tentativa não enxergou uma chave Groq configurada**. Não é uma resposta de erro do Groq. A causa exata do valor ausente (variável não cadastrada, ambiente errado ou processo/configuração desatualizados) exige inspeção do servidor. Uma mensagem preservada de tentativa antiga não comprova a configuração atual.

Sem um snapshot de materiais na prova, `ExternalResearch::find` não é chamado. Logo, o relato sem anexos afasta a hipótese anterior de falha na pesquisa externa para essa tentativa.

`compose.yaml` carrega as variáveis de `.env.production` no servidor AWS. Não há filtro que remova `GROQ_API_KEY`. Cadastrar a chave apenas na Vercel ou no `.env` do computador não a disponibiliza a esse backend. Para corrigir: conferir/preencher `GROQ_API_KEY` no ambiente de produção da instalação correta, aplicar a configuração aos processos web e de fila (recriar o serviço quando houver mudança de `env_file`, não apenas reiniciar um worker com o ambiente antigo), tratar eventual cache de configuração e fazer um teste real. A chave deve ser cadastrada no servidor, sem entrar no Git ou no chat. Depois, tentar novamente o rascunho preservado e conferir o provedor nos eventos de uso/logs.

Não há acesso administrativo à AWS disponível nesta sessão, portanto essas operações não foram executadas e não se declara o fallback corrigido em produção. Nenhum novo commit resolve, por si só, uma credencial ausente no ambiente da instalação.

## Atualização após restabelecer o acesso à AWS

A limitação de acesso acima foi superada após autorização do usuário para adicionar a origem regional EC2 Instance Connect ao SSH. A conexão foi concluída. No contêiner **de produção**, o Laravel confirmou `gemini_key` presente e `groq_key` ausente, sem cache de configuração. O arquivo `/opt/provaai-producao/.env.production` também está sem valor de `GROQ_API_KEY`.

Nos oito últimos eventos da aplicação, seis chamadas de geração Gemini retornaram HTTP 503; uma retornou HTTP 200 em 4.355 ms e uma revisão terminou sem status HTTP após 25.006 ms. Um novo teste sintético simples, sem dados escolares, retornou HTTP 200 em 0,41 s. Portanto, o Gemini apresentou falhas e voltou a responder a uma chamada simples; não foi comprovada estabilidade da geração completa. O Groq não chegou a ser testado porque falta sua credencial.

O acesso SSH está corrigido. A ativação do fallback permanece pendente de cadastro privado da chave, aplicação do ambiente ao contêiner e validação real. Detalhes e comandos de diagnóstico: [relatório de acesso AWS](2026-11-23-acesso-aws.md). Nenhum segredo foi exibido ou incluído nestes relatórios.
