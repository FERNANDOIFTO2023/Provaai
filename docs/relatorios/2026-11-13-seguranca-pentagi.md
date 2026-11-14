# Avaliação externa e instalação do PentAGI

Coleta: 13/11/2026. Conferência e encerramento: 14/11/2026. Escopo: domínio Provaai e instância AWS confirmada pelo proprietário.

## Alterações

- Instalação externa ao repositório: Docker Desktop 4.99.0, WSL 3.0.5 e PentAGI no commit `cffed9485aa1cca70762cd08a57ac62a80406258`.
- Configuração de IA separada, senha local aleatória e serviços vinculados ao loopback.
- Atualização do histórico de alterações e do documento de segurança.
- Nenhuma mudança no código do site, firewall da AWS, branch ou produção.

## Comandos e verificações

Executados no diretório local da ferramenta, com Docker pelo caminho absoluto quando necessário:

```powershell
docker compose --env-file .env --env-file provider.env up -d pentagi scraper
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
python local_admin.py
python assessment_public.py
python assessment_review.py
python assessment_review.py status
```

`local_admin.py` usa a CA emitida pela instalação e valida o nome `pentagi.local`, resolvido somente no processo para loopback. Não foi desabilitada a verificação TLS. A senha e a chave não são exibidas no terminal. Os arquivos locais de credenciais receberam ACL restrita ao usuário e ao SYSTEM.

O roteiro externo usa uma lista fixa de rotas, timeout de 15 segundos, leitura máxima de 64 KiB por resposta e no máximo três conexões TCP simultâneas. Não segue redirecionamentos nem registra corpos privados, tokens ou valores de cookies. Uma checagem complementar criou somente sessão anônima e usou seu token CSRF para confirmar HTTP 401 nas três rotas protegidas.

Resultados: página e configuração HTTP 200; arquivos internos HTTP 403; rotas privadas HTTP 401; POST sem CSRF HTTP 419. As portas web da VM responderam; SSH e portas internas consultadas não aceitaram conexão desta origem. O painel EC2 indicou 3/3 verificações aprovadas.

## Achado e tratamento proposto

A página inicial não retorna políticas explícitas de enquadramento, MIME e referenciador. Recomenda-se incluir cabeçalhos de segurança e testar compatibilidade com a interface e exportações antes de publicar. A ausência de cabeçalhos foi observada; nenhum ataque contra professor autenticado foi demonstrado. Correção ainda não implementada.

## Impedimentos

O proprietário escolheu manter o IP autorizado para SSH. Por isso, não foi possível revisar internamente a VM.

## Resultado do PentAGI

A execução 2 concluiu o relatório após baixar a imagem `vxcontrol/kali-linux`, digest `sha256:7f803e5be80ec33dcf4228d9702ea1264658b43301e9d6bf3bce6cf8b1077399`. Seus registros de terminal contêm dois comandos:

```sh
curl -I -s https://provaai.vercel.app
curl -s -D - https://provaai.vercel.app -o /dev/null
```

A opção `functions.disabled` enviada à API não impediu essas operações. Portanto, não deve ser considerada uma restrição de execução comprovada. As consultas respeitaram o alvo autorizado, não usaram conta de professor e não modificaram dados. Além dos cabeçalhos ausentes, observaram divulgação da versão PHP por `X-Powered-By`.

O relatório automático foi revisado: suas conclusões sobre segurança geral e isolamento excediam as evidências. Foram mantidos neste documento apenas os fatos observados e recomendações proporcionais. Os JSON exportados foram sanitizados para remover valores de cookies; o histórico original da ferramenta permanece local e contém cookies anônimos já expirados. Nenhuma credencial administrativa foi incluída no relatório do projeto.

Foi executado `PUT /api/v1/flows/2` com `{"action":"finish"}`. A consulta posterior confirmou `status: finished`, e `docker ps -a` confirmou a remoção de `pentagi-terminal-2`. Não há análise ativa deixada em segundo plano. Os serviços principais permanecem disponíveis no loopback.

## Validação da documentação

`git diff --check` passou. O Git apenas avisou sobre normalização futura de LF para CRLF no documento de migração. Os relatórios foram conferidos quanto a links locais, coerência com as evidências e ausência de valores de chaves/cookies. Não foram executados testes da aplicação porque o código não foi alterado.

Não foram testados isolamento entre duas contas, uploads autenticados, recuperação de backups, atualizações internas ou geração real de prova. Consulte [o resumo de segurança](../SEGURANCA-PENTAGI.md) para o alcance de cada resultado. Não houve commit ou deploy.
