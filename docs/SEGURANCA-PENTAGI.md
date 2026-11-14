# Avaliação de segurança com PentAGI

## Preparação em 13/11/2026

Foi solicitado instalar o [PentAGI](https://github.com/vxcontrol/pentagi) e avaliar o site Provaai e seu servidor. A preparação foi feita fora deste repositório, em `C:/Users/Weiva Messias/Documents/SecurityTools/PentAGI`, a partir do commit `cffed9485aa1cca70762cd08a57ac62a80406258` do projeto oficial.

O computador tem aproximadamente 32 GB de memória e tinha 118 GB livres no início da preparação. Docker Desktop 4.99.0 foi instalado pelo WinGet com verificação do instalador oficial. Após a reinicialização e a atualização do WSL para 3.0.5, o motor Docker 29.9.3 iniciou normalmente. Os contêineres `pentagi`, `scraper` e `pgvector` estão em execução; o banco passou no healthcheck.

A interface está vinculada a `127.0.0.1:8443`; os demais serviços e portas dos workers também foram restritos ao loopback. A senha administrativa padrão foi substituída por uma senha aleatória. Os arquivos de credenciais ficam fora do repositório e com acesso local restrito. Foi configurada uma chave Gemini separada, com testes bem-sucedidos de geração e embeddings. Nenhuma chave do Provaai foi copiada para a ferramenta. Os workers estão sem Docker interno e sem NET_ADMIN. O serviço principal do PentAGI usa o socket do Docker, conforme a arquitetura da ferramenta; isso não é uma sandbox sem privilégios.

**Situação em 14/11/2026:** instalação concluída e avaliação externa limitada encerrada. A imagem de análise Kali foi baixada e a execução 2 do PentAGI produziu seu relatório. O fluxo foi marcado como `finished` e seu contêiner temporário foi removido pela ferramenta. Os serviços locais permanecem disponíveis. Os resultados abaixo combinam o roteiro fixo de requisições com a conferência dos registros da ferramenta; não representam um pentest completo.

Na preparação foi enviada uma lista `functions.disabled` para restringir a revisão a evidências fornecidas. Essa restrição **não foi efetiva nesta execução**: os registros mostram uma consulta HEAD e uma GET à página pública, por `curl`. As duas consultas estavam dentro dos alvos autorizados e não alteraram dados. A configuração não deve ser tratada como controle de isolamento comprovado em futuras avaliações. O relatório e os logs foram conferidos antes do encerramento, e as cópias exportadas tiveram os valores de cookies anônimos removidos. O banco local do PentAGI conserva seu histórico original; esses cookies não correspondiam a um professor autenticado e já estavam expirados na conferência de 14/11.

A conta AWS confirmou a instância `provaai-homologacao`, na região `us-east-1`, em execução, com 3/3 verificações aprovadas e o mesmo IPv4 público. O grupo de segurança aceita HTTP/HTTPS públicos e SSH de um único IPv4 `/32`. O endereço de saída atual da estação é diferente do autorizado. O responsável optou por manter a regra, portanto a inspeção interna via SSH não foi realizada. A configuração da AWS não foi alterada.

## Resultados observados

| Verificação | Resultado | Alcance |
| --- | --- | --- |
| Página inicial e configuração | HTTP 200; backend Laravel e IA configurada | Não comprova geração de provas de ponta a ponta |
| Arquivos `/.env` e `/.git/HEAD` | HTTP 403; nenhuma assinatura de conteúdo sensível nas respostas | Somente os dois caminhos consultados |
| Download e progresso de exportação sem login | HTTP 401 | IDs e caminhos fictícios |
| POST sem CSRF para turmas, geração e exportação | HTTP 419 | Proteção CSRF observada |
| Mesmos POST com CSRF válido de sessão anônima | HTTP 401 | Autenticação exigida mesmo após passar pela proteção CSRF |
| Cookie de sessão | Secure, HttpOnly e SameSite presentes | Valores de cookies não registrados; cookie XSRF legível pelo JavaScript é esperado |
| Transporte e cache | HSTS presente; respostas consultadas com `private, no-store` | HTTPS pelo domínio da Vercel |
| Portas da VM | 80 e 443 aceitaram conexão; 22, 5432, 6379, 8080 e 8443 expiraram | Timeout indica ausência de acesso a partir desta origem, não ausência do serviço |
| HTTP pelo IP da VM | HTTP 404 | Não foi seguida nenhuma mudança de destino |

### Melhorias identificadas

Na resposta HTML da página inicial não foram observados `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` ou `Referrer-Policy`. Recomenda-se definir uma política de enquadramento (`frame-ancestors 'none'`, se não houver necessidade de incorporação), proteção contra detecção indevida de tipo (`nosniff`) e política explícita de referenciador. Uma CSP completa deve ser validada com scripts, fontes, imagens e exportações do projeto antes de ser aplicada.

A ausência foi confirmada nos cabeçalhos; não foi demonstrado um ataque de clickjacking ou XSS contra uma sessão autenticada. Trata-se de uma lacuna de proteção, não de evidência de invasão. Nenhuma correção de código ou configuração de produção foi aplicada nesta avaliação.

As consultas do PentAGI também observaram `X-Powered-By` com a versão do PHP. Remover esse cabeçalho reduz a divulgação desnecessária de detalhes técnicos, mas sua presença isolada não comprova vulnerabilidade.

O relatório automático afirmou uma segurança geral maior do que as evidências permitem. Esta documentação não adota essas conclusões: HTTP 419 não comprova isolamento entre professores, portas sem resposta não demonstram a inexistência de outros serviços, e ausência de exploração observada não certifica a aplicação. Sem `Referrer-Policy` explícita, navegadores ainda podem aplicar suas políticas padrão; não foi demonstrado vazamento pelo referenciador.

O cabeçalho CORS `Access-Control-Allow-Origin: *` apareceu na API, sem `Access-Control-Allow-Credentials`. Isso não comprova acesso cruzado a dados autenticados. Não se deve tratar o wildcard isoladamente como vazamento.

### Limitações e próximos passos

Faltam inspeção interna da VM, versões e atualizações do sistema, permissões de volumes, segredos, backups, contas de teste para isolamento entre professores, testes autenticados de upload/download e validação das políticas de cabeçalho no navegador. Não foram exercitados força bruta, geração real com IA, envio de e-mails ou exploração destrutiva. Esta avaliação não certifica que o sistema esteja livre de vulnerabilidades.

## Escopo previsto

- Aplicação: `https://provaai.vercel.app`, somente o domínio do projeto, sem varrer endereços compartilhados da Vercel.
- Servidor administrado pelo responsável: instância AWS identificada na configuração operacional do projeto.
- Começar por exposição de serviços, configurações de acesso, cabeçalhos e rotas públicas; testes autenticados devem usar contas e dados fictícios.
- Excluir negação de serviço, força bruta, envio em massa de e-mails, extração de dados de professores/alunos e alterações em produção.
- Registrar evidências mínimas, sem chaves, sessões ou conteúdo de provas reais. Diferenciar falhas confirmadas de suspeitas e verificações não realizadas.

Os roteiros e evidências sanitizadas ficam em `Documents/SecurityTools/PentAGI/assessment`, fora do código da aplicação, sem chaves ou dados de alunos. O resumo está também em [Relatório da avaliação](relatorios/2026-11-13-seguranca-pentagi.md). Não houve commit, push, deploy nem alteração dos serviços de produção.

## Acesso local

A interface fica em `https://localhost:8443`. O certificado é local e pode gerar aviso no navegador. A credencial administrativa está em `Documents/SecurityTools/PentAGI/local-admin.json`, fora do projeto; não publique esse arquivo. Para iniciar os serviços em outra ocasião, use `iniciar.cmd` na pasta da ferramenta. O ambiente inclui uma imagem Kali de aproximadamente 24,3 GB. Finalizar uma análise não remove as imagens baixadas.
