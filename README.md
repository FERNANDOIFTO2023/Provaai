# Provaai

Aplicação web para professores organizarem turmas, alunos e avaliações personalizadas. O **backend é Laravel 13 / PHP 8.3+**. A interface React/TypeScript foi preservada e integrada por Vite e uma página Blade.

## Funcionalidades

- Login por código de e-mail e sessão protegida por cookie.
- Turmas com edição, cores, ícones, capas, inativação e reativação dentro de um ano; exclusão com motivo e limpeza agendada.
- Alunos com filtros, perfis pedagógicos e acompanhamento individual.
- Compartilhamento identificado por e-mail: cópias independentes e editáveis para o destinatário.
- Gemini com Groq de reserva, geração em lote por fila e revisão das questões.
- Aprovação pelo professor, histórico por mês e exportação PDF/DOCX com gabarito opcional.
- Modelos Word e cabeçalhos PDF com recorte ajustável; questões do PDF não são enviadas à IA.

## Executar localmente

Pré-requisitos: PHP 8.3+, Composer 2 e Node 24. Extensões PHP: PDO/SQLite, mbstring, intl, fileinfo, openssl, curl, zip, XML e gd; pdo_pgsql para PostgreSQL.

```sh
composer install
npm ci
```

Copie `.env.example` para `.env` sem sobrescrever configuração existente. Crie o arquivo vazio `database/database.sqlite`, caso não exista. Depois:

```sh
php artisan key:generate
php artisan migrate
npm run build
php artisan serve
```

Gere a chave somente na primeira configuração. Em dois terminais adicionais:

```sh
php artisan queue:work --tries=1 --timeout=130
php artisan schedule:work
```

Abra `http://127.0.0.1:8000`. Localmente, `MAIL_MAILER=log` grava o código em `storage/logs/laravel.log`, sem enviar e-mail. Configure SMTP para envio real. Para editar a interface, use `npm run dev` junto do servidor PHP.

O ambiente local usa SQLite isolado; não acessa automaticamente o banco publicado. Configure `GEMINI_API_KEY` e `GROQ_API_KEY` no `.env` do Laravel. Os secrets antigos do Supabase não são transferidos automaticamente.

## Verificação

```sh
php artisan test
npm test
npm run typecheck
npm run build
```

Os testes PHP usam banco temporário e IA simulada; os testes de documentos executam o conversor real. `.github/workflows/validate.yml` executa verificações após push/PR; não publica a aplicação.

## Documentação

- [Especificação acadêmica PDF](docs/ESPECIFICACAO-LTP3-PROVAAI.pdf) e [fonte editável](docs/ESPECIFICACAO-LTP3-PROVAAI.md).
- [Guia técnico e publicação](docs/GUIA-TECNICO.md).
- [Transferência dos dados existentes](docs/MIGRACAO-LARAVEL.md).
- [Histórico de alterações](docs/MIGRACAO-LARAVEL.md#histórico-de-alterações).
- [PDF e arquivos](docs/PDF-E-ARQUIVOS.md).
- [Segurança e limitações conhecidas](docs/SEGURANCA.md).

A versão Laravel foi preparada localmente. A publicação exige hospedagem PHP/Node, worker, agendador, armazenamento persistente, SMTP e migração dos dados. O site público não foi alterado e nenhum dado de produção foi importado ou removido nesta alteração.
