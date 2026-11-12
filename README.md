<p align="center">
  <a href="https://provaai.vercel.app/">
    <img src="docs/assets/provaai-cover.gif" alt="Provaai · Cada aluno, uma possibilidade. Mascote animado da plataforma." width="100%" />
  </a>
</p>

<p align="center">
  Do perfil de cada aluno à prova impressa.<br />
  <strong>O professor escolhe o conteúdo, revisa as questões e aprova a avaliação.</strong>
</p>

<p align="center">
  <a href="https://provaai.vercel.app/"><strong>Abrir o Provaai ↗</strong></a> &nbsp;·&nbsp;
  <a href="#tecnologias-e-bibliotecas">Tecnologias</a> &nbsp;·&nbsp;
  <a href="#comece-por-aqui">Executar localmente</a> &nbsp;·&nbsp;
  <a href="docs/GUIA-TECNICO.md">Guia técnico</a> &nbsp;·&nbsp;
  <a href="docs/ESPECIFICACAO-LTP3-PROVAAI.pdf">Documentação acadêmica</a>
</p>

---

## Uma avaliação que considera cada aluno

Uma turma pode estudar o mesmo conteúdo e precisar de provas diferentes. No **Provaai**, o professor registra o perfil pedagógico de cada aluno e escolhe a matéria, os objetivos e a divisão entre questões objetivas e discursivas. Pode escrever as questões ou pedir uma primeira versão à IA.

Para percorrer o fluxo com dados fictícios, abra o [site](https://provaai.vercel.app/) e escolha **Explorar demonstração**.

| No espaço do professor | O que você pode fazer |
| --- | --- |
| **Minhas turmas** | Criar turmas com capa, cor e ícone. Cadastrar alunos com código automático, registrar dificuldades e reativar um aluno na turma de destino. |
| **Modelos de prova** | Anexar PDF, DOC ou DOCX, escolher o padrão da conta e salvar uma escolha por turma. No PDF, conferir o recorte do cabeçalho. |
| **Provas coletivas** | Preparar avaliações por turma, acompanhar a geração em segundo plano e revisar cada rascunho. |
| **Provas individuais** | Selecionar um aluno para uma avaliação específica e manter seu vínculo com a turma de origem. |
| **Revisão e downloads** | Ajustar enunciados e respostas, aprovar a prova e baixar PDF, Word ou gabarito. Em lote, acompanhar a montagem do ZIP enquanto navega. |

### Da turma à impressão

```mermaid
flowchart LR
    A[Cadastre a turma] --> B[Adicione os alunos]
    B --> C[Escolha conteúdo e modelo]
    C --> D[Prepare as questões]
    D --> E[Revise e aprove]
    E --> F[Baixe a prova]
    style A fill:#5210ce,color:#ffffff,stroke:#5210ce
    style E fill:#2adfb8,color:#0d1823,stroke:#2adfb8
    style F fill:#0d1823,color:#ffffff,stroke:#0d1823
```

O PDF usa a faixa da primeira página escolhida pelo professor como cabeçalho. No Word, o exportador aproveita a diagramação do modelo para montar o documento que também dará origem ao PDF. [Modelos e formatos de exportação](docs/PDF-E-ARQUIVOS.md)

## Tecnologias e bibliotecas

<table align="center">
  <tr>
    <td align="center" width="120"><a href="https://devicons.io/icons/laravel/"><img src="https://devicons.io/devicons/icons/laravel.svg" alt="Laravel 13" width="38" height="38" /></a><br /><sub>Laravel 13</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/php/"><img src="https://devicons.io/devicons/icons/php.svg" alt="PHP 8.3+" width="38" height="38" /></a><br /><sub>PHP 8.3+</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/react/"><img src="https://devicons.io/devicons/icons/react.svg" alt="React 19" width="38" height="38" /></a><br /><sub>React 19</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/typescript/"><img src="https://devicons.io/devicons/icons/typescript-icon.svg" alt="TypeScript" width="38" height="38" /></a><br /><sub>TypeScript</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/vite/"><img src="https://devicons.io/devicons/icons/vite.svg" alt="Vite" width="38" height="38" /></a><br /><sub>Vite</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/nodejs/"><img src="https://devicons.io/devicons/icons/nodejs-icon.svg" alt="Node.js 24" width="38" height="38" /></a><br /><sub>Node.js 24</sub></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://devicons.io/icons/html-5/"><img src="https://devicons.io/devicons/icons/html-5.svg" alt="HTML" width="38" height="38" /></a><br /><sub>HTML</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/css/"><img src="https://devicons.io/devicons/icons/css.svg" alt="CSS" width="38" height="38" /></a><br /><sub>CSS</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/javascript/"><img src="https://devicons.io/devicons/icons/javascript.svg" alt="JavaScript" width="38" height="38" /></a><br /><sub>JavaScript</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/zod/"><img src="https://devicons.io/devicons/icons/zod.svg" alt="Zod" width="38" height="38" /></a><br /><sub>Zod</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/postgresql/"><img src="https://devicons.io/devicons/icons/postgresql.svg" alt="PostgreSQL" width="38" height="38" /></a><br /><sub>PostgreSQL</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/sqlite/"><img src="https://devicons.io/devicons/icons/sqlite-icon.svg" alt="SQLite" width="38" height="38" /></a><br /><sub>SQLite</sub></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://devicons.io/icons/docker/"><img src="https://devicons.io/devicons/icons/docker-icon.svg" alt="Docker" width="38" height="38" /></a><br /><sub>Docker</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/nginx/"><img src="https://devicons.io/devicons/icons/nginx.svg" alt="NGINX" width="38" height="38" /></a><br /><sub>NGINX</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/aws/"><img src="https://devicons.io/devicons/icons/aws.svg" alt="AWS" width="38" height="38" /></a><br /><sub>AWS</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/vercel/"><img src="https://devicons.io/devicons/icons/vercel-icon.svg" alt="Vercel" width="38" height="38" /></a><br /><sub>Vercel</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/google-gemini/"><img src="https://devicons.io/devicons/icons/google-gemini.svg" alt="Gemini" width="38" height="38" /></a><br /><sub>Gemini</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/github-actions/"><img src="https://devicons.io/devicons/icons/github-actions.svg" alt="GitHub Actions" width="38" height="38" /></a><br /><sub>GitHub Actions</sub></td>
  </tr>
  <tr>
    <td align="center" width="120"><a href="https://devicons.io/icons/git/"><img src="https://devicons.io/devicons/icons/git-icon.svg" alt="Git" width="38" height="38" /></a><br /><sub>Git</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/github/"><img src="https://devicons.io/devicons/icons/github-icon.svg" alt="GitHub" width="38" height="38" /></a><br /><sub>GitHub</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/npm/"><img src="https://devicons.io/devicons/icons/npm-icon.svg" alt="npm" width="38" height="38" /></a><br /><sub>npm</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/composer/"><img src="https://devicons.io/devicons/icons/composer.svg" alt="Composer" width="38" height="38" /></a><br /><sub>Composer</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/debian/"><img src="https://devicons.io/devicons/icons/debian.svg" alt="Debian" width="38" height="38" /></a><br /><sub>Debian</sub></td>
    <td align="center" width="120"><a href="https://devicons.io/icons/bash/"><img src="https://devicons.io/devicons/icons/bash-icon.svg" alt="Bash" width="38" height="38" /></a><br /><sub>Bash</sub></td>
  </tr>
</table>

| Camada | Uso no Provaai |
| --- | --- |
| **Interface** | React 19 e TypeScript, com Vite e `laravel-vite-plugin`. HTML e CSS compõem as telas. Motion e `@heroicons-animated/react` animam os ícones, as transições e as barras de progresso. |
| **Aplicação** | PHP 8.3+ e Laravel 13. Blade entrega a página inicial, Eloquent acessa os dados e as filas executam a geração das provas. |
| **Dados** | PostgreSQL em produção e SQLite no ambiente local. A sessão, o cache e a fila usam o banco. Os modelos, capas e documentos ficam no armazenamento privado do servidor. |
| **Inteligência artificial** | Gemini gera e confere as questões. O código também oferece Groq como reserva quando configurado e Mistral como provedor opcional. |
| **Documentos** | LibreOffice WebAssembly, pelo pacote `@matbee/libreoffice-converter`, converte Word e PDF. `docx` e `@xmldom/xmldom` montam os documentos, e `word-extractor` lê os modelos Word. |
| **PDF e arquivos** | `pdfjs-dist` e `@napi-rs/canvas` recortam cabeçalhos. `jspdf` exporta PDFs na demonstração. `jszip` manipula modelos DOCX e reúne provas em ZIP, com `buffer` para compatibilidade no navegador. |
| **Validação e testes** | Zod valida os dados da interface. PHPUnit, Mockery e Faker cobrem o backend. O executor nativo de testes do Node verifica regras e arquivos. |
| **Publicação** | Docker e Compose na AWS, com imagem Debian e scripts Bash. NGINX e PHP-FPM atendem HTTP, Supervisor mantém os processos e SMTP entrega os códigos de login. A Vercel fornece a entrada pública e o GitHub Actions executa as verificações. |
| **Desenvolvimento** | Git e GitHub versionam o código. npm e Composer gerenciam as dependências. TypeScript verifica os tipos, Laravel Pint formata PHP, Tinker oferece o console e Pail auxilia na leitura dos logs. |

As versões instaladas ficam registradas em [package-lock.json](package-lock.json) e [composer.lock](composer.lock). Os ícones desta seção vêm do [Devicons](https://devicons.io/).

## Comece por aqui

Use **PHP 8.3 ou superior**, **Composer 2** e **Node.js 24**. Habilite no PHP as extensões PDO/SQLite, mbstring, intl, fileinfo, openssl, curl, zip, XML e gd. O ambiente local usa seu próprio banco SQLite.

1. Na raiz do repositório, instale as dependências.

   ```sh
   composer install
   npm ci
   ```

2. Na primeira instalação, copie `.env.example` para `.env` e crie o arquivo vazio `database/database.sqlite`. Gere a chave da aplicação uma vez e inicie o site.

   ```sh
   php artisan key:generate
   php artisan migrate
   npm run build
   php artisan serve
   ```

3. Abra [127.0.0.1:8000](http://127.0.0.1:8000). Para processar os lotes e as tarefas agendadas, execute cada comando em um terminal próprio.

   ```sh
   php artisan queue:work --tries=1 --timeout=130
   php artisan schedule:work
   ```

Com `MAIL_MAILER=log`, o código de login local aparece em `storage/logs/laravel.log`. Para gerar provas com Gemini, configure `GEMINI_API_KEY` no `.env`. A chave opcional `GROQ_API_KEY` habilita o provedor reserva. [Configuração de e-mail e IA](docs/GUIA-TECNICO.md)

## Por dentro do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `app/` e `routes/` | Sessões, acesso aos dados de cada professor, preparação das provas e processamento das filas em Laravel. |
| `components/`, `resources/` e `lib/` | Interface React, estilos, regras compartilhadas e diagramação de documentos. |
| `database/` | Migrações do banco atual e referência histórica do Supabase. |
| `scripts/` | Leitura dos modelos Word, recorte dos cabeçalhos PDF e conversão dos arquivos. |
| `tests/` e `deploy/` | Testes automatizados e configuração da aplicação na AWS. |

A aplicação e o PostgreSQL de produção rodam na AWS. A Vercel mantém o domínio público. Um push para `main` inicia a publicação na Vercel, e a VM atualiza a aplicação depois da aprovação dos testes no GitHub Actions. [Publicação e histórico de alterações](docs/MIGRACAO-LARAVEL.md#histórico-de-alterações)

<details>
<summary><strong>Desenvolvimento, testes e documentação</strong></summary>

| Comando | Uso |
| --- | --- |
| `npm run dev` | Atualizar a interface durante a edição, junto de `php artisan serve`. |
| `php artisan test` | Testar autenticação, permissões, filas, documentos e migração em banco temporário. |
| `npm test` | Testar regras da interface e arquivos de prova. |
| `npm run typecheck` | Conferir os tipos TypeScript. |
| `npm run build` | Compilar a interface para distribuição. |

- [Guia técnico](docs/GUIA-TECNICO.md)
- [Segurança e limitações conhecidas](docs/SEGURANCA.md)
- [Especificação acadêmica editável](docs/ESPECIFICACAO-LTP3-PROVAAI.md)

</details>

## Equipe

Projeto acadêmico do **IFTO**, desenvolvido na disciplina **Linguagens e Técnicas de Programação III**, com orientação do professor **Marcos Raimundo**.

**Fernando de Paula Matos** · **Vinicius Celestino** · **João Francisco** · **Gabriel Gutemberg**

<p align="center">
  <img src="public/bloub/bloub-symbol.svg" alt="" width="42" /><br />
  <strong>Provaai</strong>
</p>
