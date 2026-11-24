# Diagnóstico de acesso SSH à AWS

Data: 23/11/2026. Inspeção pelo console EC2 autenticado.

## Evidências

- Instância `provaai-homologacao`, região `us-east-1`, em execução, com 3/3 verificações de infraestrutura aprovadas.
- EC2 Instance Connect tentou conectar por IPv4 com usuário `ubuntu`, porta 22, e apresentou falha de conexão SSH.
- O grupo de segurança associado tem três regras de entrada: TCP 80 e 443 públicos e TCP 22 restrito a um único IPv4 `/32`.
- Não existe regra autorizando a origem do serviço regional EC2 Instance Connect. Isso bloqueia esse caminho de acesso antes de permitir a inspeção interna. Não comprova falha do daemon SSH nem permite concluir o estado das chaves de IA.
- A instância não exibe função IAM associada; não foi configurado novo acesso pelo Systems Manager.

Conforme os [pré-requisitos oficiais da AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-prerequisites.html), o SSH pelo console precisa aceitar o tráfego do serviço EC2 Instance Connect, identificado por lista de prefixos regional.

## Ajuste aplicado e validado

Após a autorização explícita “Sim, salvar e conectar”, foi salva no grupo `sg-013272ab366a1a1e8` a regra `sgr-0bab2c57bceb73dcc`: TCP 22 com origem `pl-0e4bcff02b13bef1e`, apresentada pelo console como `com.amazonaws.us-east-1.ec2-instance-connect`. Descrição: `Provaai - EC2 Instance Connect us-east-1 SSH`. As três regras anteriores foram preservadas; o console passou a mostrar quatro regras. Não foi aberto SSH para toda a Internet.

A conexão pelo EC2 Instance Connect foi concluída com o usuário `ubuntu`, por IPv4, na porta 22. O terminal remoto respondeu aos comandos de diagnóstico. Isso confirma que a regra de origem ausente impedia esse caminho de acesso.

## Diagnóstico interno da produção

- `sudo docker ps --format '{{.Names}} | {{.Image}}'`: produção e homologação convivem nessa instância, apesar do nome `provaai-homologacao`.
- Produção: contêiner `provaai-producao-app-1`, imagem `provaai-producao:a01d762d59dacddd951749884ba9cdad5995f11c`.
- Inspeção restrita ao label `com.docker.compose.project.working_dir`: diretório `/opt/provaai-producao`.
- Bootstrap do Laravel via `docker exec ... php -r`: provedor `gemini`, modelo `gemini-3.5-flash-lite`, reserva Groq `openai/gpt-oss-120b`; chave Gemini presente, chave Groq ausente, configuração sem cache.
- Leitura programática de `/opt/provaai-producao/.env.production`, imprimindo apenas presença/ausência: `GEMINI_API_KEY` presente; `GROQ_API_KEY` e `GROK_API_KEY` ausentes ou vazias. Não foram exibidos valores das credenciais.
- Consulta somente de provedor/modelo/etapa/status/duração/data dos oito últimos eventos em `ai_usage_events`: seis respostas Gemini HTTP 503 na geração, uma geração HTTP 200 em 4.355 ms e uma revisão sem status HTTP com duração de 25.006 ms. Os eventos lidos são de 23/11/2026, entre 19:18:57 e 19:22:51, conforme timestamps armazenados. Não foram consultados nomes, respostas de alunos ou enunciados.
- Teste real pela rede da produção, com a chave configurada internamente, usando o pedido sintético “Responda apenas OK.”: HTTP 200 em 0,41 s. Não enviou dados escolares nem criou prova. Esse teste não valida uma geração completa nem garante ausência de novas falhas intermitentes.

## Resultado e pendências

SSH corrigido e conexão confirmada. A falha relatada de geração é compatível com os HTTP 503 efetivamente registrados pelo Gemini. O fallback não estava disponível porque a chave Groq falta tanto na configuração carregada quanto no arquivo de ambiente da produção.

Para ativar a reserva, é necessário cadastrar uma chave Groq válida em `GROQ_API_KEY` no ambiente privado de produção, aplicar o ambiente ao serviço web e aos workers mediante recriação do contêiner com a imagem correta e validar a API e a geração/revisão. Não basta commit nem apenas reiniciar com o ambiente antigo. Essa etapa não foi executada: nenhuma credencial foi fornecida ou cadastrada. Não enviar a chave pelo chat nem colocá-la no Git.

Nenhum código, dado escolar ou configuração dos provedores foi alterado. Não houve staging, commit ou push. A única alteração remota foi a regra SSH autorizada. `git diff --check`: aprovado. Como os relatórios ainda não são rastreados, também foi executado `git diff --no-index --check -- /dev/null <arquivo>` para cada um. Os testes de aplicação anteriores constam no relatório de provedores e não substituem a validação real do Groq pendente.
