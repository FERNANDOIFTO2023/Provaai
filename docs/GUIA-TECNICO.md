# Guia técnico — Laravel

Atualizado em 24/11/2026. Laravel controla HTTP, autenticação, autorização, regras de negócio, Eloquent, filas e IA. React é apresentação. Node é conversor auxiliar de arquivos, sem servidor HTTP ou acesso ao banco. A aplicação e o PostgreSQL de produção estão na AWS; a Vercel encaminha o domínio público para essa origem.

## Organização

Para localizar os fluxos e entender os setores comentados em português, consulte o [Mapa do código para manutenção](MAPA-DO-CODIGO.md).

| Caminho | Responsabilidade |
| --- | --- |
| `routes/web.php` | Página Blade e API de mesma origem, com sessão e CSRF. |
| `app/Http/Controllers` | Login, registros, compartilhamento e documentos. |
| `app/Models`, `app/Policies` | Eloquent, JSON e autorização por proprietário. |
| `app/Services`, `app/Jobs` | IA, validação, fila e conversão. |
| `app/Console/Commands`, `routes/console.php` | Importação/exportação, retomada de lotes e limpeza. |
| `database/migrations` | Esquema executável do Laravel. |
| `database/legacy-supabase` | Referência histórica; não executar no banco novo. |
| `resources`, `components`, `lib` | Interface, estilos, prompts e bibliotecas de documentos. |
| `scripts/render-document.mjs` | Conversor acionado pelo serviço PHP. |
| `storage/app/private` | Arquivos privados fora da raiz pública. |

## Ambiente

Siga o README. Use PHP 8.3+, Node 24 e Composer 2. Configure PHP com `upload_max_filesize=20M`, `post_max_size=21M` e prazo de execução de 150 segundos. `NODE_BINARY` aceita caminho absoluto quando Node não está no PATH.

| Variável | Uso |
| --- | --- |
| `APP_KEY` | Chave privada gerada uma vez; preservar entre deploys. |
| `APP_URL` | Origem pública do site. |
| `APP_ENV`, `APP_DEBUG` | Produção: `production` e `false`. |
| `DB_CONNECTION` | `sqlite` local; `pgsql` para produção. |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Conexão PostgreSQL privada. |
| `DB_SCHEMA`, `DB_SSLMODE` | Schema privado e TLS (`require` em conexão externa). |
| `SESSION_DRIVER`, `SESSION_ENCRYPT`, `SESSION_SECURE_COOKIE` | `database`, `true` e `true` em HTTPS. |
| `CACHE_STORE`, `QUEUE_CONNECTION` | `database`, compartilhado por web/worker/agendador. |
| `DB_QUEUE_RETRY_AFTER` | 180 segundos, maior que o timeout do worker. |
| `MAIL_MAILER` | `log` somente local; `smtp` em produção. |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SCHEME` | Transporte e credenciais SMTP. |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Remetente autorizado. |
| `AI_PROVIDER` | `gemini` por padrão; `mistral` opcional. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Chave privada e modelo principal. |
| `GROQ_API_KEY` | Reserva `openai/gpt-oss-120b`; atende também quando só ela está configurada. |
| `MISTRAL_API_KEY`, `MISTRAL_MODEL` | Provedor opcional. |

Não coloque segredos em variáveis `VITE_`, JavaScript, Git ou logs. `.env` está ignorado. No Docker, alterar `.env.production` exige recriar o serviço com os mesmos arquivos Compose, projeto e imagem da instalação para aplicar as novas variáveis. Apenas reiniciar o contêiner ou limpar cache não recarrega seu `env_file`. Se houver cache de configuração, regenere-o no ambiente atualizado e reinicie os workers. Preserve os volumes e não misture produção e homologação.

## Funcionamento

O login usa código de seis dígitos, dez minutos de validade, digest HMAC, limite de tentativas/envios e regeneração de sessão. O marcador de atividade enviado ao frontend não autentica requisições; a credencial é o cookie HttpOnly do Laravel.

Registros são filtrados pelo proprietário e recursos/campos permitidos são explícitos. Referências de aluno, turma e modelo são verificadas no servidor. Códigos de alunos são atribuídos sob transação. O navegador não consulta Supabase diretamente.

Inativar turma define prazo de um ano-calendário. O agendador elimina turmas vencidas e registra o motivo. Exclusão manual exige motivo de 5 a 1.000 caracteres. Compartilhamentos aparecem na aba da conta destinatária identificada pelo e-mail; não há envio de e-mail de convite nesta versão. A aceitação produz cópia independente sem provas/anexos do remetente.

## IA e desempenho

Laravel envia matéria, tópicos, distribuição e perfil pedagógico, sem nome/e-mail do aluno. Gemini e Groq recebem as mesmas instruções/contexto; não há transferência de raciocínio interno. Falhas de rede, timeout e certos erros HTTP do Gemini acionam uma tentativa da etapa na Groq. Se a conferência falhar, a reserva recebe as questões prontas, sem regenerá-las. Recusas e respostas truncadas são informadas ao professor.

Formato, distribuição, duplicatas e pertinência são validados antes de salvar o rascunho. A aprovação humana permanece obrigatória. Lotes avançam no worker mesmo sem navegador aberto; uma reserva temporária evita etapas concorrentes e o agendador retoma interrupções. Cabeçalhos PDF usam cache privado de cinco minutos. Exportações prontas ficam em armazenamento privado por versão, com preparação antecipada na fila `documents`; veja [PDF e arquivos](PDF-E-ARQUIVOS.md).

Na inspeção de produção de 23/11, o Gemini retornou HTTP 503 e a chave Groq estava ausente. O fallback depende de `GROQ_API_KEY` válida no processo que executa a etapa. `aiConfigured: true` informa presença de configuração, não saúde da API. Testes simples não substituem uma geração com revisão. Consulte o [diagnóstico](relatorios/2026-11-23-verificacao-provedores.md) para as evidências datadas.

## Importação, materiais e indicadores

- `POST /api/students/import`: prévia e confirmação de XLSX para turma ativa do proprietário. Modelo em `public/modelos/modelo-alunos.xlsx`; até 5 MB e 500 alunos. A gravação é transacional e atribui códigos sem receber uma coluna de código.
- Materiais da turma: PDF/DOC/DOCX/PPT/PPTX, até cinco arquivos e 60.000 caracteres agregados. A leitura ocorre no envio; fontes e preferência ficam congeladas no rascunho. Pesquisa externa começa desativada e, sem materiais, o fluxo anterior continua. Não há OCR. Arquivos não acompanham o compartilhamento de cópias.
- `GET /api/teacher/dashboard`: sessão, filtro por proprietário e resposta `private, no-store`. Períodos de um, três ou doze meses, calendário no fuso de São Paulo e contagem de provas com questões pela criação. Tokens vêm dos provedores; ausência não equivale a zero.
- As migrações de materiais e `ai_usage_events` precisam acompanhar o código. O processo de release executa migrações; um commit ou deploy da Vercel isolado não comprova atualização da origem.
- A conferência matemática usa Python/SymPy local, com entradas delimitadas e aviso de revisão para casos não suportados. Instalação e limites em [Verificação matemática](VERIFICACAO-MATEMATICA.md).

## Publicação

O Dockerfile prepara PHP-FPM, Nginx, Node, conversor, Python/SymPy, workers de geração e documentos e agendador. A construção da imagem e a migração PostgreSQL integram o CI; os relatórios de 23/11 registram execução aprovada e publicação. Os passos abaixo orientam novas instalações e alterações, sem substituir validação em homologação.

1. Provisione PHP 8.3+/Node 24, PostgreSQL e disco persistente; a raiz pública é somente `public/`.
2. Configure segredos, SMTP real, HTTPS, `APP_DEBUG=false` e `SESSION_SECURE_COOKIE=true`.
3. Use `composer install --no-dev --optimize-autoloader`, `npm ci` e `npm run build`. Inclua as dependências Node de produção e `public/build` na imagem. O pacote de conversão do LibreOffice já contém o motor usado nas exportações.
4. Em banco novo, execute `php artisan migrate --force`; importe/confira o legado pelo guia de migração. Nunca execute `migrate:fresh` em produção.
5. Dê escrita ao processo PHP em `storage/` e `bootstrap/cache/`; preserve `storage/app/private` entre versões e faça backups de banco e arquivos.
6. Supervisione `php artisan queue:work --tries=1 --timeout=130`, `php artisan queue:work documents --queue=documents --tries=1 --timeout=420` e `php artisan schedule:work`. A conexão `documents` tem reserva de 480 segundos, superior ao timeout do worker. Como alternativa ao agendador contínuo, rode `schedule:run` por cron a cada minuto.
7. Execute `php artisan optimize` e `php artisan queue:restart`; valide `/up`, login, isolamento, upload, geração e exportação em homologação.
8. Só então altere domínio/roteamento; mantenha backup e o ambiente anterior durante a conferência.

**Supabase como PostgreSQL:** use banco novo ou schema dedicado `provaai`, criado pelo administrador e configurado com `DB_SCHEMA=provaai`. Não exponha esse schema pela Data API nem conceda acesso a `anon`/`authenticated`. Em projeto exclusivo do Laravel, a Data API pode ficar desabilitada. Laravel usa credenciais PostgreSQL privadas. Não aplique as novas migrações nas tabelas `public.sala_*` existentes.

A Vercel usa `PROVAAI_ORIGIN` para encaminhar à AWS. O serviço de release da VM consulta a branch configurada, exige CI aprovado, constrói a imagem e aplica as migrações. Confira a versão servida pela origem e os logs do release quando uma funcionalidade não aparecer. Veja [Migração e publicação](MIGRACAO-LARAVEL.md).

Referências: [Laravel 13 — deploy](https://laravel.com/docs/13.x/deployment), [Supabase — segurança da Data API](https://supabase.com/docs/guides/api/securing-your-api).
