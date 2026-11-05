# Provaai

A Provaai ajuda professores a preparar uma avaliação individual para cada aluno a partir da matéria, dos tópicos da turma e do perfil pedagógico. O professor pode escrever as questões ou pedir um rascunho à IA. Ele revisa o conteúdo e aprova cada prova antes da exportação.

**Site publicado** · [provaai.vercel.app](https://provaai.vercel.app/)  
**Especificação acadêmica** · [Documento da disciplina de Linguagens e Técnicas de Programação III](docs/Especificacao-Provaai.pdf)

## Executar no computador

Use Node.js 24 e npm. Abra um terminal na pasta que contém este arquivo e execute:

```sh
npm ci
npm run dev
```

Abra **http://127.0.0.1:3001**. Em **Explorar demonstração**, os dados são fictícios e ficam na memória da página. Experimente criar uma turma, adicionar um aluno e preparar um rascunho. Recarregar a página encerra a demonstração. Para encerrar o servidor, pressione Ctrl+C.

A configuração pública incluída aponta para o Supabase usado pelo site publicado. **Entrar com o e-mail de uma conta real acessa os dados dessa conta**, inclusive quando o site está rodando no computador. Para desenvolver com persistência isolada, configure outro projeto conforme as próximas seções.

| Comando | Para que serve |
| --- | --- |
| `npm ci` | Instala as versões registradas em `package-lock.json`. |
| `npm run dev` | Abre o servidor de desenvolvimento na porta 3001. |
| `npm test` | Executa os testes de regras, integrações simuladas e exportação. |
| `npm run typecheck` | Gera os tipos de rotas e verifica TypeScript. |
| `npm run build` | Compila a aplicação e as rotas para produção. |
| `npm start` | Serve o último build na porta 3001. Encerre o servidor de desenvolvimento antes. |

## Do cadastro à prova impressa

1. **Acesso.** Informe o e-mail e digite o código recebido para criar ou acessar a conta. O botão **Sair** encerra a sessão neste navegador e volta ao login. O mascote acompanha o ponteiro, reage à validação e aparece durante o carregamento. A interface respeita a preferência de movimento reduzido do sistema.
2. **Turmas.** Crie a turma com nome, série e matéria. Na turma, cadastre os alunos com um código único naquela turma. O perfil reúne nível, dificuldades e critérios que devem orientar a prova. Não é preciso informar turno.
3. **Modelos, se desejar.** Envie um PDF, DOC ou DOCX em **Modelos**. Acrescente orientações e confira o texto extraído. O sistema utiliza esse texto como referência pedagógica. A exportação usa a diagramação própria da Provaai.
4. **Preparação.** Abra uma turma com alunos e escolha **Preparar provas**. Selecione os alunos, informe título, tópicos e o total de 1 a 30 questões por aluno. Ao ajustar o número de objetivas, a interface calcula o número de discursivas, e vice-versa. Por exemplo, 10 questões com 6 objetivas resultam em 4 discursivas. É possível escolher todas de um único tipo.
5. **Revisão.** Em **Provas**, abra o rascunho de cada aluno. Confira enunciados, alternativas, resposta esperada, objetivo e pontuação. Questões objetivas têm quatro alternativas, e a resposta deve corresponder a uma delas. Depois da revisão, aprove a prova. Editar o conteúdo de uma prova aprovada exige nova aprovação.
6. **Entrega.** Exporte em PDF para impressão ou DOCX para edição. A versão do aluno e o gabarito do professor são arquivos separados. Ao selecionar várias provas aprovadas, o download é um ZIP com os arquivos e um manifesto CSV.

### Login no celular

Após um envio aceito, o formulário confirma em verde e orienta a consultar a caixa de entrada ou o spam. Por 10 minutos, informar o mesmo endereço novamente no navegador abre a verificação do código anterior. Recarregar a página ou abrir outra aba preserva o prazo. O navegador guarda o horário de liberação por endereço, sem armazenar o código. Um código usado com sucesso é descartado. Ao completar o prazo, **Reenviar código** permite solicitar outro.

Para aplicar esse intervalo também entre dispositivos, configure no Supabase Auth o intervalo mínimo entre envios por destinatário e a validade do código para 600 segundos. Os valores locais correspondentes são `auth.email.max_frequency` e `auth.email.otp_expiry` em `supabase/config.toml`. O deploy do site na Vercel é independente dessa configuração.

Em telas de até 760 px de largura, a faixa violeta reúne a marca e o mascote animado. O formulário começa logo abaixo. O botão principal solicita o código e **Explorar demonstração** aparece como ação secundária. Depois do envio, o espaço fica dedicado à digitação do código, ao reenvio e à troca de e-mail. Em telas baixas, o mascote ocupa menos altura. A página permite rolar quando o espaço disponível diminui.

As regras de layout ficam em `app/bloub.css`. O atributo `data-login-stage` de `components/auth-welcome.tsx` identifica as etapas de e-mail e código. [Ver o login em uma tela de 393 px](docs/login-mobile.png).

## Organização do código

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Entrada do Next.js, metadados, carregamento global e estilos. `bloub-tokens.css` centraliza a paleta e `bloub.css` aplica a identidade visual sobre a base de layout. |
| `components/teacher-app.tsx` | Decide entre login, demonstração e área autenticada. Coordena sessão e transições. |
| `components/teacher-workspace.tsx` | Navegação entre turmas, alunos, provas, modelos e ajustes. Reúne as operações do professor e o estado das telas. |
| `components/workspace-ui.tsx` | Diálogos, campos e estados vazios usados nas telas do professor. |
| `components/auth-welcome.tsx`, `email-login.tsx`, `bloub-mascot.tsx`, `screen-loader.tsx` | Apresentação do login, formulário de código, personagem e tela de espera. |
| `components/question-counts.tsx` | Campos vinculados de total, objetivas e discursivas. |
| `lib/` | Cliente Supabase, autenticação, modelo de dados e dados de demonstração, geometria do olhar, exportadores e ponte para as funções remotas. |
| `app/api/` | Três rotas HTTP do servidor para configuração, geração e leitura de modelos. |
| `supabase/functions/_shared/` | Validação das questões, distribuição, comunicação com o Gemini e regras de geração compartilhadas com o servidor Next.js. |
| `supabase/functions/sala-ai/`, `sala-ai-mistral/` | Entradas das Edge Functions e processamento de documentos por provedor. O adaptador Mistral também é usado pela geração compartilhada. |
| `supabase/templates/acesso-sala.html` | E-mail de autenticação usado no cadastro e no retorno de professores. |
| `public/schema.sql` | Instalação completa do banco em um projeto novo. |
| `public/bloub/`, `public/favicon.svg` | Símbolo e expressões estáticas e animadas do mascote. |
| `tests/`, `docs/` | Testes automatizados e especificação acadêmica da versão. |

## Banco de dados e arquivos

O navegador usa o cliente do Supabase com a sessão do professor. As políticas de segurança por linha (RLS) associam leitura e escrita ao `user_id` autenticado. Chaves compostas verificam que aluno, turma e prova pertencem ao mesmo professor.

| Recurso | Dados e relações |
| --- | --- |
| `auth.users` | Identidade do professor, gerenciada pelo Supabase Auth. |
| `sala_classes` | Turmas do professor. O campo legado `period` tem valor padrão no banco para compatibilidade com cadastros anteriores. |
| `sala_students` | Aluno, turma, código e perfil. A combinação de turma e código é única. |
| `sala_templates` | Nome, caminho do arquivo, orientações, texto extraído e estado de processamento. |
| `sala_exams` | Uma prova por registro, vinculada ao aluno e à turma, com modelo opcional. Guarda o perfil no momento da criação, conteúdo JSON, distribuição solicitada e status `draft` ou `approved`. |
| `sala_generation_jobs` | Reserva por prova para impedir duas gerações simultâneas do mesmo rascunho. |
| `sala-templates` | Bucket privado. Cada arquivo fica sob o identificador do professor. |

Os nomes técnicos com prefixo `sala` fazem parte do esquema usado em produção. Uma alteração nesses nomes exige migração coordenada das tabelas, políticas, funções e clientes.

## Configurar um Supabase separado

1. Crie um projeto. No SQL Editor do **novo projeto vazio**, execute `public/schema.sql` uma vez. O script cria tabelas, índices, políticas, trigger de revisão e bucket privado. Para um banco existente, compare o esquema e aplique uma migração específica.
2. Copie `.env.example` para `.env.local`. Preencha **juntas** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do novo projeto. A chave administrativa dá acesso privilegiado e deve ficar fora do aplicativo.
3. Em **Authentication**, habilite o provedor de e-mail e o cadastro de usuários. Configure a URL do site e os redirecionamentos para a origem correta do ambiente. Para o servidor local, use `http://127.0.0.1:3001`. No projeto publicado, a origem é `https://provaai.vercel.app`.
4. Nos modelos **Confirm sign up** e **Magic link or OTP**, cole `supabase/templates/acesso-sala.html`. Use o assunto `{{ .Token }} é seu código de acesso à Provaai`. O marcador `{{ .Token }}` no corpo é substituído pelo Supabase a cada solicitação.
5. Para entregar códigos em endereços reais, configure no Supabase seu SMTP, endereço de remetente e nome de exibição **Provaai**. A foto do remetente é configurada na conta do serviço de e-mail. A interface aceita códigos numéricos de 6 a 10 dígitos.
6. Para processar arquivos de modelo ou delegar a geração ao Supabase, publique a função do provedor escolhido. Com a CLI do Supabase instalada, execute na raiz:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy sala-ai
# Para usar Mistral, publique a função correspondente:
supabase functions deploy sala-ai-mistral
```

A configuração em `supabase/config.toml` aponta para o mapa de dependências de cada função. O GET informa disponibilidade. As operações POST validam o token do professor com `auth.getUser` antes de acessar registros. O texto extraído de um modelo deve ter de 20 a 60.000 caracteres. O upload aceita até 20 MiB. No caminho de leitura de PDF pelo Gemini, o limite é 14 MiB.

## Configuração da IA

| Variável | Onde configurar | Efeito |
| --- | --- | --- |
| `AI_PROVIDER` | Next.js local/Vercel | `mistral` seleciona Mistral. O padrão é `gemini`. |
| `GEMINI_API_KEY`, `MISTRAL_API_KEY` | Servidor Next.js ou secrets da Edge Function correspondente | Credencial privada do provedor escolhido. |
| `GEMINI_MODEL`, `MISTRAL_MODEL` | Ambiente que executa a geração | Sobrescrevem os padrões do código, `gemini-3.5-flash-lite` e `mistral-small-latest`. |
| `MISTRAL_OCR_MODEL` | Edge Function Mistral | Modelo de leitura de PDF, com padrão `mistral-ocr-latest`. |

Após alterar variáveis locais, reinicie o servidor. Na Vercel, faça um novo deploy. As chaves de IA e a senha SMTP são fornecidas pelo responsável pelo ambiente. Só a URL e a chave **publicável** do Supabase pertencem às variáveis `NEXT_PUBLIC_*`.

| Rota | Contrato |
| --- | --- |
| `GET /api/config` | Retorna `aiConfigured`, `provider` e `model`. Consulta a função remota se a chave estiver ausente no servidor. |
| `POST /api/generate` | Recebe token Bearer e JSON com `examId` e `objectiveCount` opcional. Busca a prova do professor. Com chave no Next.js, gera no servidor. Sem ela, delega à função configurada para `generate-with-mix`. |
| `POST /api/template/process` | Recebe token Bearer e `templateId`. Encaminha ao Supabase para ler o arquivo privado e registrar o texto ou a falha. |

O contexto da geração contém matéria, tópicos, distribuição, nível, dificuldades, critérios e, quando selecionado, o conteúdo do modelo. Nomes e códigos não são enviados em campos próprios ao gerador. O texto livre e os arquivos enviados para leitura podem conter informações pessoais: use descrições pedagógicas e modelos sem identificação.

A aplicação valida a resposta do provedor antes de salvar. Confere a divisão entre questões, o formato das alternativas e a repetição de enunciados após normalizar espaços e maiúsculas. Os rascunhos ficam disponíveis para nova tentativa em caso de falha. Modelos enviados servem de referência de conteúdo e instruções, inclusive quando a exportação final é DOCX.

## Publicação e verificação

Na Vercel, importe a pasta que contém `package.json` e `vercel.json` como raiz do projeto, selecione o framework **Next.js** e use Node.js 24. Defina as variáveis do ambiente escolhido. A configuração fornecida instala com `npm ci`, compila com Next.js e reserva até 150 segundos para as rotas de geração e processamento, conforme os limites da conta. O banco, o SMTP e as Edge Functions são configurados no Supabase separadamente.

Para conferir uma instalação:

- Rode `npm test`, `npm run typecheck` e `npm run build`. A suíte cobre códigos de acesso, movimento do olhar, distribuição solicitada, erros dos provedores, repetição de questões e exportação com e sem gabarito. As chamadas de autenticação e IA dos testes usam respostas simuladas.
- Abra a demonstração, navegue pelas quatro seções e use **Sair**. Em uma turma com alunos, prepare um rascunho e verifique a divisão de questões.
- No ambiente de homologação, entre com um e-mail que você controla. Cadastre dados fictícios, envie um modelo curto e peça uma prova. Confira o texto extraído e revise a prova antes de exportar. Esse teste usa o SMTP e pode consumir cota do provedor.

| Sintoma | O que conferir |
| --- | --- |
| Código de acesso não chega | Pasta de spam, endereço, entrega no SMTP, limites de reenvio e os dois modelos de autenticação. |
| Mensagem sobre configuração do banco | Projeto apontado pela URL e chave pública, execução do SQL e políticas para a conta autenticada. |
| IA pendente em Ajustes | Provedor selecionado, chave no ambiente correto, função publicada e compatibilidade com a distribuição de questões. |
| Modelo com erro de leitura | Formato real do arquivo, limites de tamanho/texto e credencial para leitura de PDF. Confira a mensagem do modelo antes de tentar novamente. |
| Exportação indisponível | Abra o rascunho, confira as questões e aprove. Revisões de conteúdo voltam o status a rascunho. |

