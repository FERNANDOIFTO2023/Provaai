# Migração para Laravel

## Estado em 10/11/2026

Backend migrado para Laravel 13/PHP 8.3+, com React/Vite na apresentação. Next.js, SDK Supabase no navegador e Edge Functions deixaram o runtime. Login, negócio, Eloquent, IA, compartilhamento, filas e arquivos são controlados pelo Laravel. Node permanece apenas como conversor.

Foram executados testes PHP de autenticação, isolamento, regras, cópias, IA simulada, filas, documentos reais e transferência de dados; testes JavaScript, TypeScript e build. Login local e retorno entre telas foram conferidos no navegador. SMTP real, IA real, PostgreSQL hospedado e Docker ainda precisam de homologação.

O site público não foi alterado nem seus dados importados. O SQLite local é separado. Secrets já existentes no Supabase precisam ser cadastrados no ambiente privado do novo servidor.

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

## Pendências externas

### Publicar em um servidor gratuito da instituição ou uma VM Always Free

O arquivo `compose.yaml` utiliza o Linux com Docker já disponível no servidor. Ele mantém PDFs, modelos e capas em um volume local persistente. As contas, provas, fila e sessões ficam no PostgreSQL. Web, worker e agendador rodam no mesmo serviço.

1. No servidor, confira que a hospedagem e o espaço em disco estão incluídos a custo zero. Confira também que as contas dos provedores de IA, SMTP e banco estão nas modalidades gratuitas, sem cobrança por excedente. Atinja a cota e aguarde a renovação, sem ativar faturamento.
2. Crie `.env.production` fora do controle de versão, com permissões de leitura restritas. Use a configuração PostgreSQL, a chave Laravel, o SMTP, a URL HTTPS e as chaves de IA descritas no guia técnico. Aponte o Laravel para um schema privado vazio, separado da versão atual.
3. No diretório do projeto execute `docker compose build`, depois `docker compose run --rm app php artisan migrate --force` e `docker compose up -d`. Confira `http://127.0.0.1:8080/up` no servidor. Configure o proxy HTTPS da instituição ou da VM para esse endereço.
4. Mantenha o novo endereço restrito à equipe até concluir a transferência. Entregue o manifesto e a pasta de anexos juntos por canal privado. Execute a importação com o mesmo usuário do PHP (`docker compose exec --user www-data app php artisan provaai:import-legacy CAMINHO/manifest.json`, primeiro sem e depois com `--apply`).
5. Inclua o volume de documentos e o banco nas cópias de segurança. Recriar o contêiner preserva o volume. O comando `docker compose down -v` remove o volume e seus documentos.

Hospedagem PHP, disco persistente, SMTP, chaves de IA, transferência real, homologação Docker/PostgreSQL e domínio. Drive segue no backlog. Os nomes do professor e integrantes na capa acadêmica precisam ser informados pela equipe.
