# Migração para Laravel

## Estado em 11/11/2026

Backend migrado para Laravel 13/PHP 8.3+, com React/Vite na apresentação. Next.js, SDK Supabase no navegador e Edge Functions deixaram o runtime. Login, negócio, Eloquent, IA, compartilhamento, filas e arquivos são controlados pelo Laravel. Node permanece apenas como conversor.

Os testes cobrem autenticação, isolamento entre professores, cópias, geração com IA simulada, filas, documentos e transferência de dados. O GitHub Actions também constrói a imagem Docker de produção, migra um schema PostgreSQL temporário, abre a aplicação, importa um usuário fictício e extrai o cabeçalho de um modelo PDF. A homologação roda na AWS com PostgreSQL. O Gemini gerou provas coletivas e individuais, e o Gmail autenticou o remetente. Um código solicitado pelo login de homologação chegou à caixa de entrada do Gmail usado como remetente. A importação e a restauração de uma cópia dos dados reais passaram na AWS.

A produção e a homologação da AWS usam bancos, volumes de documentos e chaves de sessão próprios. O SQLite local é independente desses ambientes.

## Histórico de alterações

### 11/11/2026 — Entrada em produção

- O domínio público passou a servir o Laravel na AWS após o avanço de `main` para `96124ff`. A página de login e os arquivos de interface responderam pelo domínio. A rota de login rejeitou um endereço inválido com HTTP 422 e a rota de dados exigiu autenticação. [Publicação na Vercel](https://vercel.com/fernandotribalism-1622/provaai/DTNeR1VjsAJEj9FKAupe971sZnGf)
- A comparação dos campos importados com o manifesto passou. Uma prova aprovada foi exportada em PDF e DOCX a partir da cópia na AWS. Uma segunda cópia do backup foi guardada fora da VM e conferida por SHA-256.
- O corte confirmou, na mesma transação no Supabase, que os dados ainda correspondiam à exportação, que os anexos vinculados existiam e que não havia lote ativo. Os gatilhos `provaai_arquivo_20261111` bloqueiam gravações da aplicação antiga. As sessões de professores recomeçam por código enviado ao e-mail de cadastro.
- Para consultar a atualização automática, use `sudo journalctl -u provaai-producao-release.service`. A configuração de produção está em `/etc/provaai/release-production.env` e o checkout em `/opt/provaai-producao`. O timer de homologação usa a sua própria configuração.
- Para restaurar uma versão anterior do Laravel, preserve o banco e os documentos atuais e confira a compatibilidade do esquema. Para voltar ao Supabase depois de novas gravações na AWS, reconcilie os registros e anexos primeiro. Só depois remova os gatilhos do corte nas relações que usam `public.provaai_arquivo_20261111()` e redirecione o domínio.

### 11/11/2026 — Restauração de dados e origem de produção

- O manifesto real foi importado em um PostgreSQL isolado. O banco e os anexos foram copiados e restaurados em outro destino. Conferiram os identificadores dos professores e dos registros, além do conteúdo de cada arquivo por SHA-256.
- A instalação de produção recebeu o conjunto validado, em rede, banco e volume próprios. O serviço escuta em 127.0.0.1:8081. O Nginx encaminha o prefixo HTTPS /producao para essa instalação. A Vercel usa esse prefixo na variável PROVAAI_ORIGIN de Production.
- A atualização por GitHub permite escolher o checkout, o endereço de saúde local e o repositório de imagens de cada instalação. A produção acompanha main e a homologação acompanha codex/migracao-laravel.

### 11/11/2026 — Preparação do ensaio com dados do Supabase

- O painel do projeto indicou ausência de backups. Foi preparada uma exportação das contas, tabelas e anexos vinculados para uma pasta privada na AWS. A credencial é usada apenas durante a leitura da origem.
- A rotina de restauração foi exercitada com um manifesto vazio em um PostgreSQL isolado na VM. Ela importa o manifesto, copia o banco e os documentos, restaura a cópia em outro banco e compara os identificadores e os hashes dos arquivos. O ensaio com dados reais depende da exportação.

### 11/11/2026 — Autenticação do Gmail na homologação

- A VM autenticou o remetente no Gmail por SMTP com STARTTLS na porta 587. Após a troca da caixa de testes pelo Gmail, o contêiner passou a usar o novo servidor e o Laravel respondeu HTTP 200 em `/up`. A senha de app fica na configuração privada da VM. No teste de entrega, a rota de login emitiu um código novo para o endereço do próprio remetente. O Gmail aceitou o envio e o destinatário confirmou o recebimento na caixa de entrada.

### 11/11/2026 — Preparação da publicação contínua

- O Nginx da homologação recebeu um certificado TLS para o IPv4 da VM, com renovação automática pelo Certbot e recarga do Nginx. A porta 80 só atende ao desafio de emissão. A porta 443 exige autenticação de homologação, exceto em `/up` e `/api/config`. PostgreSQL e Mailpit continuam privados. Uma mudança do IPv4 exige reemitir o certificado e atualizar a origem da prévia.
- A Vercel recebeu `PROVAAI_ORIGIN` apenas na prévia de `codex/migracao-laravel`. O navegador entrou pelo endereço da Vercel, recebeu o código na caixa de testes e concluiu o envio de PDF e DOCX ao Laravel na AWS. A conta e os anexos temporários foram removidos. O timer também instalou a imagem do commit aprovado. [Prévia compilada na Vercel](https://vercel.com/fernandotribalism-1622/provaai/2DFq18RreMtGbCgtpXJoVyfkyb9u) · [Testes do commit](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/42962684013)
- Após configurar o Gemini, a geração e a revisão reais produziram uma prova coletiva de Ciências e uma individual de Matemática com uma questão objetiva e uma discursiva cada. A primeira chamada da individual recebeu erro do provedor e preservou o rascunho vazio. A repetição passou pelas duas etapas. Os dados fictícios do teste foram revertidos. O Supabase de produção usa Gmail com SMTP na porta 587. A entrega real pelo Laravel e a transferência dos dados ainda precisam de validação antes do corte.
- A homologação passou a consultar o resultado do GitHub Actions antes de instalar um commit. O serviço escolhe o SHA exato da branch configurada, constrói a imagem e só troca o contêiner depois de aplicar as migrações. Em seguida, verifica `/up` e a resposta Laravel em `/api/config`. Uma falha nessa etapa aciona a restauração da imagem anterior. A restauração da imagem não desfaz alterações no banco.
- A configuração da Vercel passou a gerar rotas pela Build Output API. Ela usa `PROVAAI_ORIGIN` para encaminhar as requisições ao Laravel. O build exige uma origem HTTPS que responda às verificações de saúde e, em produção, que informe um provedor de IA configurado. A folha de estilos e o JavaScript usam caminhos relativos ao domínio pelo qual o professor acessou o site.
- A suíte com IA simulada e a migração Docker/PostgreSQL passaram no CI. Na geração solicitada diretamente na VM, o Laravel informou ausência da chave de IA e preservou o rascunho vazio. A caixa de teste, o banco da homologação e o acesso pelo túnel são independentes do e-mail, dos dados e do endereço de produção. [Verificação do GitHub Actions](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/42961655122)

### 11/11/2026 — Validação de modelos de prova na AWS

- O upload de um PDF terminava, mas a leitura retornava HTTP 500 e o modelo permanecia pendente. Na VM, o conversor encerrava o processo quando apenas 65.536 bytes da resposta tinham sido entregues ao Laravel. A imagem do cabeçalho precisava de várias escritas no canal entre os processos.
- O conversor agora aguarda a entrega completa do resultado. Se uma resposta chegar incompleta, a aplicação registra a falha de leitura e permite tentar novamente. Um teste executa o conversor com um cabeçalho maior que 128 KiB e compara a imagem recebida byte a byte. [Correção e testes no GitHub](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/42960420564)
- A imagem `8fdc9f9` foi instalada na VM de homologação. O PDF pendente foi reprocessado a partir do arquivo já salvo e a prévia PNG foi conferida. Em uma conta de teste, o envio simultâneo de PDF e DOCX pelo navegador concluiu a validação dos dois formatos. A conta e os anexos de teste foram removidos.
- A produção na Vercel acompanha os pushes para `main`. A Vercel também tentou construir uma prévia da branch `codex/migracao-laravel`; a prévia falhou na configuração Next.js do projeto. A atualização da VM usa Docker Compose e é feita separadamente. [Deploy de produção verificado](https://vercel.com/fernandotribalism-1622/provaai/7yCqPjMT1i1yQvcMHwxYnYFhBCUv)

### 10/11/2026 — Validação da branch e preparação da VM

1. A branch `codex/migracao-laravel` incorporou a versão de `main` com suporte ao cabeçalho PDF. Um teste local com o modelo fornecido confirmou a presença do cabeçalho no arquivo exportado.
2. O GitHub Actions passou a construir a imagem de produção e testar a migração em PostgreSQL 16. Na primeira execução, o teste HTTP encontrou a conexão fechada durante a inicialização do servidor. Depois do ajuste na espera, passaram a inicialização do site, a importação de uma conta fictícia e a extração do cabeçalho PDF dentro da imagem. [Execução validada em `aa2a51f`](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/42925429907)
3. Após conferir as instâncias existentes e a elegibilidade do tipo de máquina, foi criada a VM de homologação na região `us-east-1`, com Ubuntu 24.04, instância `t3.small`, créditos de CPU no modo padrão e volume gp3 criptografado de 24 GiB. O grupo de segurança permite SSH apenas a partir do IP da estação de administração.
4. A VM recebeu Docker, Compose, Buildx e 2 GiB de swap para a compilação. O checkout foi fixado em `aa2a51f`. O PostgreSQL tem volume persistente e o Mailpit recebe os e-mails de homologação. A configuração privada está em `/etc/provaai` na VM.
5. A estação de administração recebeu o atalho **Abrir Provaai AWS**. Ele usa um túnel SSH para abrir o site em `http://127.0.0.1:18080` e a caixa de e-mails de teste em `http://127.0.0.1:18025`. Se o IP da estação mudar, é preciso atualizar a regra de SSH. Se a VM for parada e receber outro IPv4 ao religar, é preciso atualizar também o destino do túnel.
6. A imagem compilou na VM e o Laravel aplicou as quatro migrações. O EC2 confirmou a integridade do sistema e da instância. O endpoint `/up` respondeu HTTP 200 e o volume de documentos aceitou escrita pelo usuário do PHP. Nginx, PHP-FPM, o consumidor de filas e o agendador estavam em execução.
7. O teste pelo Edge abriu a página pelo túnel, solicitou um código para um endereço fictício, leu a mensagem no Mailpit e entrou no painel com a sessão autenticada. A conta, o código e a sessão de teste foram removidos. A contagem de professores voltou a zero para permitir o ensaio de importação.
8. Dentro do contêiner, o conversor extraiu o cabeçalho do modelo PDF de teste e exportou uma prova fictícia nos dois formatos. Foram conferidos a assinatura do arquivo PDF e a integridade do pacote DOCX. Os arquivos temporários foram removidos ao final.

## Transferir dados

Faça backup completo do Supabase antes do corte. O exportador transfere contas sem senhas/tokens, tabelas funcionais e modelos/capas vinculados. Não inclui sessões, códigos, fila em andamento, auditorias antigas de exclusão ou arquivos órfãos; preserve-os no backup completo conforme a política de retenção.

1. Conclua lotes e suspenda novas gravações no ambiente antigo durante a exportação para obter um conjunto consistente.
2. Configure temporariamente `LEGACY_SUPABASE_URL` e `LEGACY_SUPABASE_SERVICE_KEY` no ambiente de migração, nunca no Git/navegador. Só são aceitas URLs HTTPS de projeto Supabase.
3. Exporte para pasta nova fora do repositório:

```sh
php artisan provaai:export-supabase CAMINHO_DO_BACKUP
```

4. Configure banco Laravel novo e execute suas migrações. Valide sem gravar:

```sh
php artisan provaai:import-legacy CAMINHO_DO_BACKUP/manifest.json
```

5. Confira contagens e aplique no destino vazio:

```sh
php artisan provaai:import-legacy CAMINHO_DO_BACKUP/manifest.json --apply
```

O importador preserva UUIDs, valida proprietários/referências e hashes, converte convites antigos e recusa contas ou arquivos já existentes no destino. Professores entram novamente por código de e-mail. Os testes utilizaram dados fictícios e HTTP simulado; a primeira transferência real exige conferência em homologação.

6. Compare quantidades por professor, turmas, alunos, provas e modelos; abra anexos, aceite cópia pendente e exporte provas amostradas. Teste login real e isolamento entre contas.
7. Remova os secrets administrativos temporários e proteja o backup. Só então mude o tráfego público. Após novas gravações no Laravel, uma reversão exige reconciliar esses dados.

## Contrato do backup

JSON com `version: 1`, `users`, `tables` e `files`. Cada arquivo informa `bucket`, `path`, `source` relativo ao manifesto e `sha256`. Buckets: `sala-templates` e `class-banners`. O exportador produz esse contrato; o importador também aceita manifesto preparado manualmente.

`database/legacy-supabase` é referência histórica, não deve ser executada no destino novo.

## Operação e referência de instalação

### Publicar novas versões pelo GitHub

O timer `provaai-release.timer` consulta a branch a cada três minutos, mesmo com a estação do professor desligada. Na VM de teste, `/etc/provaai/release.env` seleciona `PROVAAI_BRANCH=codex/migracao-laravel` e os arquivos Compose da homologação. O serviço é instalado a partir de `deploy/release.sh` em `/usr/local/sbin/provaai-release`; as duas unidades de `deploy/` ficam em `/etc/systemd/system/`. Para acompanhar uma atualização, use `sudo journalctl -u provaai-release.service -f`. Versões que alterem o esquema precisam ser compatíveis com a versão anterior até o fim da troca.

Para o primeiro corte, prepare um banco e um volume de documentos próprios para produção. A homologação já contém dados de teste e o importador exige destino vazio. Configure o SMTP externo, o remetente e a chave do provedor de IA no ambiente privado da aplicação. Mantenha a credencial administrativa do Supabase em um ambiente temporário exclusivo da exportação. Valide uma prova coletiva e uma individual com temas diferentes, a entrega do código por e-mail, a importação de uma cópia dos dados e a restauração do backup.

Na Vercel, configure `PROVAAI_ORIGIN` separadamente para Preview e Production com a URL HTTPS da instalação correspondente. Teste a prévia de ponta a ponta com o domínio da Vercel, inclusive a sessão após o login e os downloads. Depois da homologação e da transferência final, a instalação de produção deve acompanhar `PROVAAI_BRANCH=main`. O push para `main` dispara o build na Vercel e o CI usado pela VM. O acompanhamento da branch exige um serviço já instalado e em execução na VM de destino.

### Escolher o servidor de homologação

Uma instância Linux x86-64 do Amazon EC2 pode hospedar o Compose durante a homologação. Para contas elegíveis criadas a partir de 15/07/2025, o plano gratuito termina em seis meses ou quando os créditos acabam, o que ocorrer primeiro. Confira o saldo e a data de término no painel de faturamento antes de criar a VM. Inclua as exportações PDF e DOCX no teste de memória e mantenha uma cópia dos dados fora da VM. [Regras do EC2 Free Tier](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html)

### Subir o ambiente Linux

O arquivo `compose.yaml` utiliza o Linux com Docker já disponível no servidor. Ele mantém PDFs, modelos e capas em um volume local persistente. As contas, provas, fila e sessões ficam no PostgreSQL. Web, worker e agendador rodam no mesmo serviço.

1. No servidor, confira que a hospedagem e o espaço em disco estão incluídos a custo zero. Confira também que as contas dos provedores de IA, SMTP e banco estão nas modalidades gratuitas, sem cobrança por excedente. Atinja a cota e aguarde a renovação, sem ativar faturamento.
2. Crie `.env.production` fora do controle de versão, com permissões de leitura restritas. Use a configuração PostgreSQL, a chave Laravel, o SMTP, a URL HTTPS e as chaves de IA descritas no guia técnico. Aponte o Laravel para um schema privado vazio, separado da versão atual.
3. No diretório do projeto execute `docker compose build`, depois `docker compose run --rm app php artisan migrate --force` e `docker compose up -d`. Confira `http://127.0.0.1:8080/up` no servidor. Configure o proxy HTTPS da instituição ou da VM para esse endereço.
4. Mantenha o novo endereço restrito à equipe até concluir a transferência. Entregue o manifesto e a pasta de anexos juntos por canal privado. Execute a importação com o mesmo usuário do PHP (`docker compose exec --user www-data app php artisan provaai:import-legacy CAMINHO/manifest.json`, primeiro sem e depois com `--apply`).
5. Inclua o volume de documentos e o banco nas cópias de segurança. Recriar o contêiner preserva o volume. O comando `docker compose down -v` remove o volume e seus documentos.

Antes de direcionar o domínio ao Laravel, configure a entrega externa de e-mail e o provedor de IA, teste uma geração de ponta a ponta e ensaie a importação e a restauração de uma cópia do backup. A VM e seus volumes consomem créditos enquanto estiverem em uso.
