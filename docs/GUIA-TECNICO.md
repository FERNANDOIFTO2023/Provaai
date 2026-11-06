# Guia técnico da Provaai

A Provaai ajuda professores a preparar uma avaliação individual para cada aluno a partir da matéria, dos tópicos da turma e do perfil pedagógico. O professor pode escrever as questões ou pedir um rascunho à IA. Ele revisa o conteúdo e aprova cada prova antes da exportação.

**Site publicado** · [provaai.vercel.app](https://provaai.vercel.app/)  
**Especificação acadêmica** · [Documento da disciplina de Linguagens e Técnicas de Programação III](Especificacao-Provaai.pdf)

[← Voltar à apresentação do projeto](../README.md)

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
2. **Turmas.** Crie a turma com nome, série e matéria. Na turma, cadastre os alunos. O campo de código já vem preenchido automaticamente (A001, A002 e assim por diante) e é somente para leitura. Ao salvar, o sistema consulta os códigos da turma, inclusive os de alunos retirados, e confirma a exclusividade no banco. Se outro cadastro ocupar o código durante o preenchimento, o próximo disponível é atribuído automaticamente e informado na confirmação. Editar o perfil mantém o código já vinculado ao aluno. O perfil reúne nível, dificuldades e critérios que devem orientar a prova. Não é preciso informar turno.
3. **Modelos, se desejar.** Em **Modelos**, arraste os arquivos PDF, DOC ou DOCX para a área de envio ou clique nela para selecioná-los. Depois, dê um nome a cada modelo e confira o texto extraído. Acompanhe o envio e a leitura no painel ou selecione **Continuar em segundo plano** para trabalhar em outra tela da Provaai. Mantenha a aba aberta. Cada modelo fica disponível para gerar provas assim que sua leitura termina. Em caso de erro de leitura, use **Ler arquivo novamente** no arquivo já salvo. Após a leitura, use **Definir como padrão**. Ao preparar provas, a turma começa em **Seguir meu padrão**. Escolher outro modelo e confirmar **Preparar provas** guarda a escolha apenas nessa turma. Para voltar a acompanhar o padrão do professor, selecione **Seguir meu padrão** na próxima preparação. Cada prova guarda a referência escolhida no momento da criação. O texto do modelo orienta a IA. Modelos DOCX também fornecem o cabeçalho, logotipos, rodapés e configuração de página da exportação. PDF e DOC servem como referência de conteúdo e usam a diagramação padrão na saída.
4. **Preparação.** Abra uma turma com alunos e escolha **Preparar provas**. Selecione os alunos, informe título, tópicos e o total de 1 a 30 questões por aluno. Ao ajustar o número de objetivas, a interface calcula o número de discursivas, e vice-versa. Por exemplo, 10 questões com 6 objetivas resultam em 4 discursivas. É possível escolher todas de um único tipo.
5. **Revisão.** Em **Provas**, abra o rascunho de cada aluno. Confira enunciados, alternativas, resposta esperada, objetivo e pontuação. Questões objetivas têm quatro alternativas, e a resposta deve corresponder a uma delas. Depois da revisão, aprove a prova. Editar o conteúdo de uma prova aprovada exige nova aprovação.
6. **Entrega.** Exporte em PDF para impressão ou DOCX para edição. A versão do aluno e o gabarito do professor são arquivos separados. Ao selecionar várias provas aprovadas, o download é um ZIP com os arquivos e um manifesto CSV.

### Provas coletivas, individuais e saída de alunos

Os nomes da interface são **Provas coletivas** (antes **Minhas provas**) e **Provas individuais** (antes **Recuperação**). A troca é apenas de apresentação: os fluxos, dados e identificadores internos continuam os mesmos.

A seção **Provas coletivas** apresenta uma pasta visual para cada turma, com total de provas, pendências de revisão e aprovações. Abra a turma para buscar por aluno, código ou título e filtrar o estado da revisão. A seleção e o ZIP incluem apenas as provas aprovadas da lista exibida. O botão **Preparar provas** abre a preparação diretamente para aquela turma.

A seção **Provas individuais** permite buscar um aluno já cadastrado por nome, código ou turma e adicioná-lo ao acompanhamento individual. O atalho **Prova individual**, na lista da turma, faz o mesmo cadastro. Esse vínculo é adicional: o aluno continua na turma de origem. Cada preparação seleciona exatamente um aluno, usa o perfil pedagógico dele e cria uma nova prova, com revisão e exportação próprias. O histórico fica na página Provas individuais, separado das avaliações regulares. A escolha de modelo vale para essa prova e não altera a preferência da turma. A IA recebe a finalidade de recuperação e consulta os enunciados anteriores do aluno para evitar repetições exatas. A revisão pedagógica continua sendo responsabilidade do professor.

Na turma, **Retirar** pede confirmação e arquiva o vínculo do aluno. Ele deixa de aparecer nas seleções de novas provas coletivas e individuais. Provas existentes permanecem disponíveis; o histórico de provas individuais de retirados pode ser consultado selecionando **Alunos inativos** no filtro de situação. Essa opção lista todos os alunos retirados das turmas do professor, mesmo sem vínculo anterior com Provas individuais. A página abre com **Alunos ativos** por padrão; a busca por nome, código ou turma respeita a situação selecionada. Em **Alunos retirados**, use **Restaurar** para reativar o cadastro e seu vínculo anterior com Provas individuais. Nenhum desses botões apaga provas ou perfis. Durante um lote em andamento, a interface bloqueia a retirada.

A migração `20261105235000_recovery_and_archived_students.sql` adiciona `sala_students.archived_at`, `sala_exams.purpose` (`regular` ou `recovery`) e `sala_recovery_students`. A tabela de vínculos usa RLS e chave composta de aluno/professor. A função `sala_begin_exam_batch` exige um único aluno ativo e cadastrado na recuperação para essa finalidade. Turmas regulares continuam usando o fluxo anterior. Triggers impedem preparar ou gerar novas provas para alunos arquivados, inclusive por chamadas diretas. A recuperação compartilha o bloqueio de geração por professor com as demais provas.

As telas estão em `components/exam-library.tsx` e `components/recovery-workspace.tsx`; filtros e regras de busca ficam em `lib/exam-library.ts`. Os testes de `tests/recovery.test.mjs` verificam separação de listas, busca sem acentos, isolamento entre contas, manutenção da turma e da preferência de modelo, bloqueio de simultaneidade, retirada e restauração.

### Reativar um aluno e escolher a turma

Em **Provas individuais → Alunos inativos**, use **Reativar aluno** e escolha a **Turma de destino**. A turma anterior aparece selecionada inicialmente. Na mesma turma, o código é mantido; em outra, um código é calculado automaticamente considerando também os alunos inativos daquele destino. O aluno mantém o identificador e o perfil, volta ao estado ativo e passa a aparecer na lista de provas individuais. O filtro muda para ativos após a confirmação.

A migração `20261106161318_reactivate_student_in_class.sql` deve ser aplicada antes de publicar essa interface. A função `sala_reactivate_student` faz a alteração e o vínculo individual em uma transação, com RLS, validação do professor e serialização das reativações da conta. O índice único da turma continua protegendo o código contra cadastros simultâneos.

As provas anteriores mantêm a turma, o conteúdo e o código salvos na criação. As chaves estrangeiras verificam separadamente a propriedade da turma e do aluno; um trigger exige que novas provas pertençam à turma atual. Alterar apenas o conteúdo de uma prova histórica continua permitido. Para gerar novamente com IA após uma transferência, prepare uma prova na turma atual. Uma geração em andamento impede retirar, reativar ou transferir alunos até terminar.

### Geração de provas em segundo plano

Ao confirmar o preparo com IA, o servidor salva os rascunhos e reserva um único lote por professor, inclusive entre abas e dispositivos. O painel mostra quantas provas foram processadas. O professor pode navegar e continuar o trabalho nas demais telas. Os rascunhos concluídos ficam disponíveis para revisão em **Provas**. Quando uma prova falha, o lote continua e o rascunho fica disponível para nova tentativa depois da conclusão.

A migração de lotes em `supabase/migrations/` instala a fila e a proteção por conta. A rota `/api/exam-batch` reserva uma prova por chamada. Em produção, o servidor inicia a próxima usando a origem configurada pela Vercel. Se a execução for interrompida ou a sessão expirar, uma aba autenticada retoma o trabalho. Em desenvolvimento, mantenha a aba aberta para avançar o lote. Se o Gemini 3.5 Flash-Lite devolver HTTP 503, o gerador tenta uma vez o Gemini 3.1 Flash-Lite dentro do mesmo prazo.

### Encerramento por inatividade

A interface encerra a sessão depois de 30 minutos sem interação. Aos 28 minutos, apresenta um aviso com contagem regressiva e o botão **Continuar conectado**. Essa confirmação inicia um novo prazo. Renovação automática do token, consultas ao banco, retorno do foco e abertura da página não contam como interação.

O relógio fica em `lib/idle-session.ts` e `components/use-idle-session.ts`. A última atividade é salva por usuário e identificador de sessão; não contém tokens. A marca inicial só é criada depois da verificação bem-sucedida do código de e-mail. Antes de montar o espaço do professor, a aplicação verifica a atividade salva. Sessões antigas sem esse registro exigem novo login uma vez. Com armazenamento bloqueado, o relógio funciona em memória e a reabertura exige login. Abas da mesma origem compartilham as marcas de atividade e encerramento.

Downloads, envios de modelos, geração de provas e operações de salvamento em andamento na aba adiam a saída automática. O aviso informa essa espera. Ao terminar a última operação, a sessão encerra se o prazo já passou e não houve confirmação. Fechar a aba não mantém essa exceção nem reinicia o prazo.

O controle é uma política de inatividade da interface. Ao expirar, ela retira o espaço do professor da tela, marca a sessão como encerrada e solicita a saída local ao Supabase. Não altera a duração dos JWTs no servidor nem substitui autenticação e RLS. Mesmo sem rede, a marca local impede a restauração automática da conta. O prazo do código enviado por e-mail continua sendo de 10 minutos, independente da sessão.

### Login no celular

Após o envio, o formulário orienta o professor a conferir a caixa de entrada ou o spam. Durante os 10 minutos seguintes, ele pode usar o mesmo código para entrar mais de uma vez, inclusive em outro dispositivo. Pedir de novo nesse prazo mostra a orientação para usar o código anterior. Um login bem-sucedido zera a contagem de erros e preserva o horário de expiração.

Na quinta tentativa incorreta consecutiva, o servidor invalida o código anterior e solicita outro para o mesmo endereço imediatamente. O novo prazo começa quando o Supabase aceita o envio. Se a entrega for recusada, o professor vê o erro e pode tentar novamente. Cada endereço tem um limite de seis solicitações de envio por hora, incluindo substituições.

A Edge Function `provaai-auth` controla os prazos no banco e usa o SMTP configurado no Supabase. O primeiro login valida o código no Auth. Para permitir novo login, o servidor guarda uma assinatura HMAC vinculada ao endereço e ao código, junto com o identificador do professor. Os acessos seguintes recebem sessões próprias. A tabela e as funções de controle são privadas. Se o Auth bloquear uma substituição pelo intervalo do destinatário, a função libera o relógio de envio apenas para a conta com uma reserva válida e um envio anterior recente. As cotas gerais do provedor continuam valendo.

Em telas de até 760 px de largura, a faixa violeta reúne a marca e o mascote animado. O formulário começa logo abaixo. O botão principal solicita o código e **Explorar demonstração** aparece como ação secundária. Depois do envio, o espaço fica dedicado à digitação do código, ao reenvio e à troca de e-mail. Em telas baixas, o mascote ocupa menos altura. A página permite rolar quando o espaço disponível diminui.

As regras de layout ficam em `app/bloub.css`. O atributo `data-login-stage` de `components/auth-welcome.tsx` identifica as etapas de e-mail e código. [Ver o login em uma tela de 393 px](login-mobile.png).

## Organização do código

### Movimento dos ícones

Os ícones usam [Heroicons Animated](https://github.com/heroicons-animated/heroicons-animated), com Motion 12, conforme a compatibilidade declarada pela biblioteca. `components/animated-icons.tsx` importa cada desenho individualmente e aciona sua animação original quando o mouse entra no botão ou campo, ou quando o controle recebe foco pelo teclado. Ao sair, o ícone retorna ao estado normal. Os eventos são removidos ao desmontar o componente. Botões desabilitados não acionam efeitos; indicadores de carregamento mantêm seu giro separado. A preferência de movimento reduzido desativa as animações. `app/icon-motion.css` cuida apenas das dimensões e do alinhamento dos novos ícones.

Use Motion 12 para manter a compatibilidade com Heroicons Animated. Para instalar o projeto com pnpm, execute `pnpm install --frozen-lockfile`. O `package-lock.json` atende ao fluxo de `npm ci` na Vercel. Ao alterar dependências com pnpm, sincronize esse arquivo com `npm install --package-lock-only --ignore-scripts`.

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Entrada do Next.js, metadados, carregamento global e estilos. `bloub-tokens.css` centraliza a paleta e `bloub.css` aplica a identidade visual sobre a base de layout. |
| `components/teacher-app.tsx` | Decide entre login, demonstração e área autenticada. Coordena sessão e transições. |
| `components/teacher-workspace.tsx` | Navegação entre turmas, alunos, provas, modelos e ajustes. Reúne as operações do professor e o estado das telas. |
| `components/workspace-ui.tsx` | Diálogos, campos e estados vazios usados nas telas do professor. |
| `components/auth-welcome.tsx`, `email-login.tsx`, `bloub-mascot.tsx`, `screen-loader.tsx` | Apresentação do login, formulário de código, personagem e tela de espera. |
| `components/question-counts.tsx` | Campos vinculados de total, objetivas e discursivas. |
| `lib/` | Cliente Supabase, autenticação, modelo de dados e dados de demonstração, geometria do olhar, exportadores e ponte para as funções remotas. |
| `app/api/` | Rotas HTTP para configuração, geração, lotes, leitura de modelos e exportação autenticada. |
| `supabase/functions/_shared/` | Validação das questões, distribuição, comunicação com o Gemini e regras de geração compartilhadas com o servidor Next.js. |
| `supabase/functions/sala-ai/`, `sala-ai-mistral/` | Entradas das Edge Functions e processamento de documentos por provedor. O adaptador Mistral também é usado pela geração compartilhada. |
| `supabase/templates/acesso-sala.html` | E-mail de autenticação usado no cadastro e no retorno de professores. |
| `supabase/functions/provaai-auth/`, `supabase/migrations/` | Login por código e regras de prazo, tentativas e envio. |
| `public/schema.sql` | Esquema inicial de turmas, alunos, provas e modelos. |
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
| `sala_teacher_template_defaults` | Modelo padrão da conta. A turma pode ter uma referência própria em `sala_classes`. As políticas de acesso e as chaves de professor impedem referências a modelos de outras contas. |
| `sala_exams` | Uma prova por registro, vinculada ao aluno e à turma, com modelo opcional. Guarda o perfil no momento da criação, conteúdo JSON, distribuição solicitada e status `draft` ou `approved`. |
| `sala_generation_jobs` | Reserva por prova para impedir duas gerações simultâneas do mesmo rascunho. |
| `sala-templates` | Bucket privado. Cada arquivo fica sob o identificador do professor. |

Os nomes técnicos com prefixo `sala` fazem parte do esquema usado em produção. Uma alteração nesses nomes exige migração coordenada das tabelas, políticas, funções e clientes.

## Configurar um Supabase separado

1. Crie um projeto. No SQL Editor do **novo projeto vazio**, execute `public/schema.sql` uma vez. O script cria tabelas, índices, políticas, trigger de revisão e bucket privado. Em seguida, execute os arquivos SQL de `supabase/migrations/` na ordem do nome. Para um banco existente, compare o esquema e aplique uma migração específica.
2. Copie `.env.example` para `.env.local`. Preencha **juntas** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do novo projeto. A chave administrativa dá acesso privilegiado e deve ficar fora do aplicativo.
3. Em **Authentication**, habilite o provedor de e-mail e o cadastro de usuários. Configure a URL do site e os redirecionamentos para a origem correta do ambiente. Para o servidor local, use `http://127.0.0.1:3001`. No projeto publicado, a origem é `https://provaai.vercel.app`.
4. Nos modelos **Confirm sign up** e **Magic link or OTP**, cole `supabase/templates/acesso-sala.html`. Use o assunto `{{ .Token }} é seu código de acesso à Provaai`. O marcador `{{ .Token }}` no corpo é substituído pelo Supabase a cada solicitação.
5. Para entregar códigos em endereços reais, configure no Supabase seu SMTP, endereço de remetente e nome de exibição **Provaai**. A foto do remetente é configurada na conta do serviço de e-mail. Use 600 segundos para a validade e o intervalo normal por destinatário. Publique a função de login antes de publicar o site. A interface aceita códigos numéricos de 6 a 10 dígitos.
6. Para processar arquivos de modelo ou delegar a geração ao Supabase, publique a função do provedor escolhido. Com a CLI do Supabase instalada, execute na raiz:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy provaai-auth
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

A aplicação valida a resposta do provedor antes de salvar. Confere a divisão entre questões, o formato das alternativas e a repetição de enunciados após normalizar espaços e maiúsculas. Os rascunhos ficam disponíveis para nova tentativa em caso de falha. O conteúdo e as instruções dos modelos orientam a geração. A diagramação de modelos DOCX é aplicada na exportação, depois da revisão do professor.

## Exportação com o modelo DOCX

A rota `POST /api/export/exam` recebe token Bearer e `{id, format: "pdf" | "docx", answerKey?: boolean}`. Busca a prova aprovada e o arquivo do modelo com a sessão e o identificador do professor. O navegador não envia conteúdo para substituir a prova salva. O arquivo permanece no bucket privado; o download não usa links públicos nem um serviço externo de conversão.

`lib/docx-layout.ts` abre o DOCX selecionado e mantém imagens, cabeçalhos, rodapés, margens e estilos do pacote original. Preenche rótulos vazios como `Nome do estudante:`, `Aluno:`, `Turma:`, `Nome do professor:` e `Disciplina:`, inclusive em tabelas. Um parágrafo `Tema` ou `Título` recebe o título da prova. O nome do professor só é preenchido quando existe em `user_metadata.full_name`; caso contrário, fica em branco. As questões entram depois desses campos. Atividades antigas depois do último campo reconhecido são substituídas; não são copiadas como novas questões. O gabarito é exportado separadamente.

Prepare preferencialmente um modelo com cabeçalho e campos vazios, seguido de `Tema`. Campos já preenchidos, caixas de texto, tabelas complexas de atividades e formulários arbitrários não são mapeados automaticamente. Sem campos reconhecidos, o corpo é substituído pelo conteúdo da prova, mantendo cabeçalho, rodapé e configuração da página. Um cabeçalho diferente na primeira página continua diferente nas páginas seguintes, conforme o arquivo enviado. PDF e DOC não fornecem diagramação editável nesta versão.

Para PDF, `lib/office-pdf.ts` converte esse mesmo DOCX com LibreOffice WebAssembly, preservando os símbolos Unicode em vez de desenhar texto com a fonte básica do jsPDF. A demonstração offline mantém o exportador simples. Fontes ausentes no motor podem ser substituídas por equivalentes. O conversor roda em worker e limita as conversões a uma por instância. O mesmo worker atende aos próximos documentos e é descartado após um minuto sem uso, evitando inicializar o LibreOffice para cada prova do ZIP. A primeira conversão ainda precisa abrir o motor. ZIPs são preparados sequencialmente.

`npm run dev` e `npm run build` executam `scripts/prepare-office.mjs`, que prepara os arquivos compactados em `.office-runtime/`. O build inclui esses arquivos na função de exportação; não coloque essa pasta gerada no Git. O servidor descompacta o motor na pasta temporária da instância. Não exige uma instalação local do LibreOffice. A rota tem prazo de 150 segundos; o navegador encerra a espera após 160 segundos por arquivo e apresenta uma mensagem para tentar novamente. O pacote `@matbee/libreoffice-converter` e o LibreOffice mantêm suas licenças de terceiros, disponíveis nos respectivos pacotes/fontes.

Provas existentes que guardaram o `template_id` de um DOCX passam a usar o modelo no próximo download; não é necessário gerar o conteúdo novamente. Se a prova foi criada sem esse vínculo, escolher um novo padrão da turma não altera a prova antiga. Arquivos já baixados também não mudam.

### Downloads em segundo plano

O botão de download abre um acompanhamento com o mascote e a opção **Continuar navegando**. O processo permanece no espaço do professor ao trocar de seção ou fechar o modal. Um aviso mostra quantos arquivos foram preparados. Geração de novas provas, novos downloads e saída da conta aguardam a conclusão; as outras telas continuam disponíveis. Mantenha a aba aberta: o processo não é retomado após fechar ou recarregar a página. O navegador avisa se houver uma tentativa de saída durante a preparação.

O estado fica em `components/use-exam-download.ts`, separado das ações de salvar. O bloqueio imediato evita cliques repetidos antes da atualização da interface. Em caso de falha, os controles são liberados e a mensagem permanece disponível. O progresso conta documentos concluídos; não estima uma porcentagem interna da conversão.

`lib/export-cache.ts` reutiliza arquivos prontos por até cinco minutos na mesma instância, com limite total de 24 MiB. A rota autentica o professor e verifica a propriedade e a aprovação antes de consultar o cache. A chave contém o professor, os dados completos da prova, o formato, a opção de gabarito, os campos preenchidos e os bytes atuais do modelo. Alterações nesses dados exigem nova renderização. Requisições simultâneas idênticas compartilham o trabalho; falhas não ficam no cache. Não há URLs públicas para esses arquivos. Instâncias novas ou cache expirado ainda precisam converter o documento.

## Publicação e verificação

### Turmas, alunos e cópias entre professores

O histórico do navegador acompanha as abas, os detalhes de turmas, as provas coletivas e os formulários do espaço do professor. Voltar e Avançar restauram a tela correspondente sem desfazer dados já salvos.

Em **Editar turma**, o professor altera nome, série, matéria, turno, cor e ícone. As turmas podem ser filtradas por ativas e inativas. Inativar mantém os dados por um ano de calendário, contado pelo servidor em UTC; reativar antes do vencimento cancela a exclusão. Uma nova inativação inicia outro prazo. A rotina diária exclui turmas vencidas, os alunos ainda vinculados e as provas da turma ou desses alunos. Alunos já transferidos para outra turma permanecem cadastrados. Excluir imediatamente exige motivo de 5 a 1000 caracteres e confirmação do nome na interface; o banco guarda o motivo, o proprietário e a data em `sala_class_deletions`.

A aba **Alunos** reúne os perfis com busca por nome, código, turma e matéria, filtros ativo/inativo e turma, edição e reativação. O status do aluno é independente do status da turma; novas matrículas e provas exigem uma turma ativa.

**Compartilhar cópia** recebe o e-mail do destinatário. O convite aparece na aba **Compartilhamentos** da conta que confirmar esse e-mail; esse fluxo não dispara uma mensagem de e-mail. O destinatário aceita uma turma inteira ou escolhe uma turma ativa própria para receber um aluno. A cópia conserva os perfis e os status dos alunos; uma turma copiada nasce ativa. Provas, arquivos de modelos e preferências de modelos não são copiados. Os dados são fotografados no momento do compartilhamento: edições posteriores no original não alteram a cópia. O recebimento é atômico e idempotente, e os códigos individuais são gerados na turma de destino. O remetente pode cancelar convites pendentes; cópias já recebidas são independentes.

As migrações `20261106181131_class_lifecycle_and_copies.sql` e `20261106181139_schedule_class_cleanup.sql` devem estar aplicadas antes de publicar esta interface. A segunda instala o [Supabase Cron](https://supabase.com/docs/guides/cron/install) e registra `provaai-purge-inactive-classes`, diariamente às 03:15 UTC (00:15 em Brasília). A exclusão acontece na próxima execução após o prazo, não depende de visitas ao site e pode ser acompanhada em `cron.job_run_details`. As políticas de acesso dos dados originais continuam restritas ao proprietário; somente as operações de cópia autorizadas por e-mail verificado criam os novos registros.

Na Vercel, importe a pasta que contém `package.json` e `vercel.json` como raiz do projeto, selecione o framework **Next.js** e use Node.js 24. Defina as variáveis do ambiente escolhido. A configuração fornecida instala com `npm ci`, compila com Next.js e reserva até 150 segundos para as rotas de geração e processamento, conforme os limites da conta. O banco, o SMTP e as Edge Functions são configurados no Supabase separadamente.

Para conferir uma instalação:

- Rode `npm test`, `npm run typecheck` e `npm run build`. A suíte cobre códigos de acesso, movimento do olhar, distribuição solicitada, erros dos provedores, repetição de questões e exportação com e sem gabarito. As chamadas de autenticação e IA dos testes usam respostas simuladas.
- Abra a demonstração, navegue por Turmas, Provas coletivas, Provas individuais, Modelos e Ajustes e use **Sair**. Em uma turma com alunos, prepare um rascunho e verifique a divisão de questões.
- No ambiente de homologação, entre com um e-mail que você controla. Cadastre dados fictícios, envie um modelo curto e peça uma prova. Confira o texto extraído e revise a prova antes de exportar. Esse teste usa o SMTP e pode consumir cota do provedor.

| Sintoma | O que conferir |
| --- | --- |
| Código de acesso não chega | Pasta de spam, endereço, entrega no SMTP, limites de reenvio e os dois modelos de autenticação. |
| Mensagem sobre configuração do banco | Projeto apontado pela URL e chave pública, execução do SQL e políticas para a conta autenticada. |
| IA pendente em Ajustes | Provedor selecionado, chave no ambiente correto, função publicada e compatibilidade com a distribuição de questões. |
| Modelo com erro de leitura | Formato real do arquivo, limites de tamanho/texto e credencial para leitura de PDF. Confira a mensagem do modelo antes de tentar novamente. |
| Exportação indisponível | Abra o rascunho, confira as questões e aprove. Revisões de conteúdo voltam o status a rascunho. |
