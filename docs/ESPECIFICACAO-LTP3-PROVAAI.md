# Documento de especificação — Provaai

Instituto Federal de Educação, Ciência e Tecnologia do Tocantins — Campus Paraíso do Tocantins
Curso de Bacharelado em Sistemas de Informação
Disciplina: Linguagens e Técnicas de Programação III
Professor: Marcos Raimundo
Equipe: Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg
Paraíso do Tocantins — 2026

Revisão documental: 25/11/2026. Base funcional: código e registros de validação disponíveis até esta data.

# 1. HISTÓRICO DE ALTERAÇÕES

O quadro reúne as principais mudanças de escopo, interface e implementação até 25/11/2026. Os registros anteriores à migração foram agrupados por período de desenvolvimento. A indicação 1.x identifica essa fase do projeto, sem atribuir um número de lançamento a cada ajuste. A versão 2.0 corresponde à migração para Laravel e às correções posteriores; as novas linhas não representam lançamentos adicionais.

O início do desenvolvimento é estimado em 04/11/2026, conforme a lembrança da equipe e o registro inicial da documentação. O primeiro commit disponível é de 05/11/2026; por isso, a data de início deve ser lida como aproximada.

| Data / período | Versão | Descrição da alteração | Autor |
| --- | --- | --- | --- |
| Início de nov./2026 | 1.0 | Definição do nome Provaai e da identidade visual em violeta, menta e tons neutros. Adequação dos textos de acesso e do e-mail com código de login à marca. Registro inicial do escopo e dos requisitos. | Equipe |
| 04 a 06/11/2026 | 1.x | Reformulação da tela de login com o mascote, acompanhamento do cursor pelo olhar e reação de negação em erros de preenchimento. Redução dos espaços na versão mobile e inclusão do estado de carregamento entre telas. | Equipe |
| 04 a 06/11/2026 | 1.x | Navegação pelo cabeçalho e saída da conta com retorno ao login. Ajustes nas mensagens de envio e validação do código, no intervalo de reenvio e no encerramento de sessão por inatividade. | Equipe |
| 04 a 06/11/2026 | 1.x | Organização da preparação de provas a partir de turmas cadastradas. Retirada do campo turno e geração automática do código de cada aluno, com confirmação de disponibilidade ao salvar. | Equipe |
| 04 a 06/11/2026 | 1.x | Definição da quantidade de questões objetivas e discursivas dentro do total escolhido. Inclusão da revisão do rascunho, aprovação docente e exportação da prova e do gabarito. | Equipe |
| 05 a 06/11/2026 | 1.x | Suporte a vários modelos por professor, com padrão geral e escolha própria por turma. Inclusão do envio por clique ou arraste e organização do processamento de anexos em segundo plano. | Equipe |
| 05 a 06/11/2026 | 1.x | Geração de avaliações e preparação de downloads em segundo plano. Liberação da navegação durante o processamento e bloqueio de novas operações conflitantes até a conclusão. | Equipe |
| 05 a 06/11/2026 | 1.x | Separação das provas por turma e inclusão da preparação para um aluno específico. Renomeação das seções para Provas coletivas e Provas individuais, preservando o vínculo do aluno com a turma de origem. | Equipe |
| 05 a 06/11/2026 | 1.x | Filtros de alunos ativos e inativos. Retirada da turma por inativação e reativação com escolha da turma de destino, mantendo o histórico de provas. | Equipe |
| 06/11/2026 | 1.x | Edição da turma pelo cartão e pela página interna. Inclusão de dez cores, seleção de ícones e foto de banner com recorte. Simplificação do cabeçalho e adoção de ícones com animações discretas ao passar o mouse ou receber foco. | Equipe |
| 07/11/2026 | 1.x | Revisão da integração de geração para respeitar a matéria e os conteúdos informados em cada pedido. Ajustes nos provedores e nas verificações das questões, evitando reaproveitar o tema de uma avaliação anterior do mesmo aluno. | Equipe |
| 08/11/2026 | 1.x | Revisão parcial de segurança: autenticação, isolamento de dados, compartilhamento e exportação. Registro da necessidade de limitar os recursos consumidos na descompactação de DOCX; a análise não foi tratada como comprovação de ausência de falhas. | Equipe |
| 09/11/2026 | 1.x | Inclusão do cabeçalho visual de modelos PDF, com recorte para reaplicação nas provas. Separação entre o layout do modelo e os conteúdos solicitados para a avaliação. | Equipe |
| 10/11/2026 | 2.0 | Migração do backend para Laravel, preservando a interface React. Centralização da autenticação, regras de negócio, arquivos privados e fila no servidor. Atualização da especificação e preparação dos testes com PostgreSQL e Docker. | Equipe |
| 10/11/2026 | 2.0 | Preparação da VM de homologação na AWS, com banco persistente, processamento de filas e agendador. Validação inicial do acesso, da importação e da exportação de documentos no ambiente de teste. | Equipe |
| 11/11/2026 | 2.0 | Correção da leitura de modelos PDF na AWS: o conversor passou a aguardar a entrega completa da imagem do cabeçalho. Reprocessamento do arquivo pendente e conferência do envio de modelos PDF e DOCX. | Equipe |
| 11/11/2026 | 2.0 | Configuração do Gmail para envio dos códigos e teste de recebimento. Validação da geração com Gemini na homologação, exportação e restauração do backup, separação dos ambientes e transferência dos dados para produção na AWS. | Equipe |
| 11/11/2026 | 2.0 | Manutenção do domínio público da Vercel, com encaminhamento à aplicação na AWS. Configuração da publicação pela branch main e da atualização da VM condicionada à aprovação dos testes no GitHub Actions. | Equipe |
| 11/11/2026 | 2.0 | Correção da retomada de geração pelo editor: o pedido passou a utilizar o rascunho e a turma já vinculados, eliminando o erro de campo class_id obrigatório. Melhoria das mensagens e dos registros de falha dos provedores. | Equipe |
| 11/11/2026 | 2.0 | Preservação do modelo escolhido na geração e na exportação. Inclusão da conversão de DOC para DOCX, reaproveitamento da montagem dos documentos em cache e conferência do cabeçalho e da distribuição das questões nos arquivos de saída. | Equipe |
| 11/11/2026 | 2.0 | Inclusão de porcentagem no download, com acompanhamento do preparo, transferência e montagem do ZIP. Adição de progresso por etapas na geração com IA, mantendo o acompanhamento durante a navegação. | Equipe |
| 11/11/2026 | 2.0 | Revisão da README com capa animada, tecnologias em uso e ícones Devicons. Criação do kit de marca e telas editáveis no Figma; a conferência final do kit permanece pendente. Atualização deste histórico e da identificação da equipe. | Equipe |
| 13/11/2026 | 2.0 | Proteções da main para colaboradores, revisão pelo proprietário e CI obrigatório. Correção do histórico de navegação para não reabrir edições concluídas ao usar Voltar. Reformulação de Modelos de prova e Provas individuais; seção Sobre no lugar de Ajustes. | Equipe |
| 16/11/2026 | 2.0 | Comentários explicativos em português e mapa do código. Preparação antecipada de documentos após aprovação, fila própria de exportação e armazenamento privado de arquivos prontos por versão. Conferência matemática local com SymPy nos formatos suportados. | Equipe |
| 23/11/2026 | 2.0 | Modelo Excel para importar alunos, prévia e confirmação transacional; códigos automáticos por turma. Acesso em Alunos, cartões e páginas das turmas. Ampliação dos testes de isolamento entre professores. | Equipe |
| 23/11/2026 | 2.0 | Materiais privados PDF, Word e PowerPoint por turma, leitura no envio e escolha de pesquisa externa. Painel de materiais reorganizado para facilitar a leitura. | Equipe |
| 23/11/2026 | 2.0 | Área do professor com períodos, gráficos, calendário por intensidade, indicadores de provas e consumo informado pelos provedores. Publicação dos painéis de materiais e atividade confirmada; perfil sem envio de foto. | Equipe |
| 23 a 24/11/2026 | 2.0 | Diagnóstico de indisponibilidade de geração: respostas HTTP 503 do provedor principal e ausência da chave de reserva na produção inspecionada. Revisão da documentação, identificação acadêmica e sincronização dos PDFs. | Equipe |
| 24/11/2026 | 2.0 | Separação do salvamento da revisão e da confirmação de aprovação. Atualização da prova pela resposta do servidor, sem recarregar toda a conta; liberação dos formatos sem aguardar a preparação antecipada dos arquivos. | Equipe |
| 25/11/2026 | 2.0 | Tela compacta de downloads após aprovação confirmada, com PDF, DOCX e gabarito. Inclusão das etapas de salvamento, foco nos erros e limite de espera por requisição. Preservados os bloqueios de operações simultâneas e a exigência de nova aprovação após edição. Funcionamento da aprovação confirmado pelo responsável após o ajuste. | Equipe |
| 25/11/2026 | 2.0 | Retirada do título interno nos arquivos da prova do aluno, mantendo identificação, cabeçalho, questões e formato do gabarito. Atualização do cache para reconstruir os documentos. Validação local de exportações, conversão e regras do servidor; publicação não executada nesta entrega. | Equipe |

Responsáveis pelo projeto: Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg. Professor: Marcos Raimundo. O quadro registra as entregas do projeto de forma conjunta, sem atribuir tarefas individuais não documentadas.

As seções seguintes descrevem a implementação atual. Relatórios datados preservam as evidências e limitações de cada entrega; um teste local aprovado não comprova disponibilidade contínua dos serviços externos.

# 2. DEFINIÇÃO DO PROJETO

## 2.1 Tema

Tecnologia educacional: organização de turmas e preparação de avaliações personalizadas para apoiar o trabalho de professores.

## 2.2 Objetivo do software

O Provaai busca reduzir o trabalho repetitivo de organizar perfis de alunos e elaborar versões de provas adequadas às necessidades pedagógicas de cada turma. Seu público principal é o professor, que informa matéria, tópicos, dificuldades e critérios, revisa as questões sugeridas e aprova o material antes de exportá-lo.

A aplicação reúne turmas, alunos, modelos e histórico de avaliações em um ambiente web. A IA atua como apoio à elaboração; o professor mantém a decisão sobre conteúdo, adequação e uso da prova. O compartilhamento cria cópias editáveis, preservando a independência de cada conta.

## 2.3 Delimitação e situação da entrega

O backend Laravel atende ao requisito da disciplina e mantém a interface React. A aplicação e o PostgreSQL estão publicados na AWS, com a Vercel encaminhando o domínio público para essa origem. A atualização da origem depende do CI aprovado, da construção da imagem e da aplicação das migrações. A integração com Google Drive e a seleção de tema claro/escuro permanecem propostas futuras.

Na inspeção de 23/11, a geração apresentou respostas HTTP 503 do Gemini e a produção não tinha a chave Groq configurada. Uma reprodução com o contrato de geração recebeu a indicação de alta demanda do modelo. Isso limita a disponibilidade da geração automática, sem significar que a publicação ou os cadastros estejam indisponíveis. A reserva precisa de credencial válida e validação real após sua configuração.

Em 25/11, o responsável confirmou que o fluxo de aprovação voltou a disponibilizar os downloads. A retirada do título impresso foi concluída e validada localmente; sua publicação não foi executada nesta entrega. A revisão documental não constitui uma nova inspeção da disponibilidade dos provedores de IA.

Professor responsável: Marcos Raimundo. Equipe: Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg.

# 3. REQUISITOS DO SISTEMA

## 3.1 Requisitos funcionais (RF)

| Código | Requisito |
| --- | --- |
| RF001 | Autenticar professores por código de e-mail, com validade, limite de tentativas e encerramento de sessão. |
| RF002 | Cadastrar e editar turmas: nome, série, disciplina, período, cor, ícone e capa. |
| RF003 | Inativar turmas, permitir reativação antes de um ano e excluir turmas vencidas por tarefa agendada. Exigir motivo na exclusão manual. |
| RF004 | Cadastrar e editar perfis de alunos com dificuldades, critérios pedagógicos e nível; atribuir código único dentro da turma. |
| RF005 | Listar alunos por turma e status, com busca; permitir inativação e reativação, inclusive em outra turma ativa. |
| RF006 | Compartilhar turma ou aluno com professor identificado por e-mail. A aceitação cria cópia independente e editável pelo destinatário. |
| RF007 | Anexar modelos Word/PDF, processar seu conteúdo apropriado ao formato e configurar modelo padrão ou por turma. |
| RF008 | Usar apenas o cabeçalho visual recortado de um PDF como modelo; não utilizar suas questões como conteúdo para a IA. |
| RF009 | Gerar provas coletivas e individuais a partir de matéria, tópicos, quantidade, distribuição e perfil pedagógico. |
| RF010 | Usar Gemini como primeira opção e Groq como reserva para falhas elegíveis, mantendo as instruções e o contexto da etapa. |
| RF011 | Executar lotes em fila no servidor, mostrar progresso e retomar etapas interrompidas. |
| RF012 | Validar estrutura, distribuição, duplicatas e pertinência; salvar como rascunho para revisão e aprovação pelo professor. |
| RF013 | Após aprovação confirmada pelo servidor, exibir tela de download em PDF ou DOCX, com gabarito opcional. O título interno não é impresso na prova do aluno. Alterações relevantes exigem nova aprovação. |
| RF014 | Organizar provas por mês/ano e permitir retornar à tela anterior pelo botão do navegador. |
| RF015 | Disponibilizar modelo Excel e importar alunos para turma ativa pertencente ao professor, com prévia, confirmação e códigos automáticos, sem coluna de código na planilha. |
| RF016 | Anexar materiais PDF, DOC, DOCX, PPT e PPTX dentro de turmas existentes, conferir o texto lido e controlar sua remoção e download autenticado. |
| RF017 | Oferecer pesquisa externa desmarcada por padrão; com anexos e pesquisa desativada, exigir apoio nas fontes. Sem anexos, manter a geração pela matéria e pelos tópicos. |
| RF018 | Exibir atividade por período, provas coletivas/individuais, aprovações, questões e calendário com cores mais intensas conforme a quantidade de provas. |
| RF019 | Exibir consumo de tokens informado pelos provedores, chamadas e duração, identificando dados desconhecidos ou parciais sem inventar histórico. |
| RF020 | Conferir resultados matemáticos nos formatos suportados e sinalizar divergências ou necessidade de revisão, sem substituir a aprovação do professor. |
| RF021 | Preparar documentos após a aprovação em fila própria e reaproveitar arquivos válidos da mesma versão; preservar questões novas em cada geração. |
| RF022 | Apresentar a seção Sobre e manter o perfil sem envio de fotografia nesta versão. |

## 3.2 Requisitos não funcionais (RNF)

| Código | Requisito |
| --- | --- |
| RNF001 | Utilizar obrigatoriamente Laravel no backend, com rotas, regras, autenticação e persistência implementadas em PHP. |
| RNF002 | Restringir dados e arquivos ao professor autenticado; verificar também os proprietários das referências entre registros. |
| RNF003 | Manter credenciais privadas no servidor, fora do repositório e do bundle do navegador; usar HTTPS e cookies seguros na publicação. |
| RNF004 | Validar entradas e saídas, proteger operações com CSRF e limitar tentativas de autenticação. |
| RNF005 | Aplicar transações, chaves estrangeiras e unicidade para preservar vínculos e evitar códigos duplicados. |
| RNF006 | Manter arquivos privados fora da raiz pública, com upload máximo de 20 MiB e respostas de download sem cache público. |
| RNF007 | Reduzir processamento repetido por extração de materiais no envio, preparação antecipada de exportações e reaproveitamento privado por versão. Latência depende de fila, conversor e provedores; não prometer download imediato em todas as situações. |
| RNF008 | Oferecer interface responsiva, controles identificados, feedback de erros/progresso e organização consistente. Limitar a espera de cada gravação de prova a 60 segundos no cliente, preservando a revisão e informando a incerteza do salvamento se não houver resposta. |
| RNF009 | Versionar código e migrações, manter testes automatizados, documentação de operação e backups de banco/arquivos. |
| RNF010 | Preservar revisão humana: a IA auxilia o professor, não aprova automaticamente avaliações ou decisões pedagógicas. |
| RNF011 | Respeitar movimento reduzido, oferecer foco visível e alternativa textual aos gráficos; restringir métricas ao professor autenticado. |
| RNF012 | Exigir PR, aprovação do proprietário e CI para colaboradores, conforme CONTRIBUTING.md; a conta proprietária tem a exceção documentada. |

Os requisitos descrevem o comportamento implementado ou o critério de operação. Aspectos dependentes de infraestrutura, carga e acessibilidade assistiva exigem homologação; não se presume aprovação apenas pela existência do código.

## 3.3 Modelagem das funcionalidades e telas

Representação esquemática do fluxo principal da aplicação. As caixas abaixo são um modelo de navegação, não capturas de tela.

Fluxo: Acesso → Minhas turmas → Alunos/modelos → Gerar em fila → Revisar/aprovar → Exportar PDF/DOCX.

| Tela | Conteúdo e ações |
| --- | --- |
| Acesso | E-mail → código → área do professor; mensagens de prazo e reenvio. |
| Minhas turmas | Busca/status, cartões de turmas, cadastro e edição de aparência. |
| Área do professor | Indicadores por período, gráfico, calendário mensal, consumo e atualização dos dados. Acesso por Meu espaço. |
| Detalhe da turma | Lista de alunos, importação Excel, materiais de estudo, preferência de pesquisa, edição e preparação de provas. |
| Alunos | Busca, filtros de status e turma, modelo Excel, importação, reativação e compartilhamento de cópia. |
| Provas coletivas / individuais | Histórico por mês, acompanhamento do lote, abertura do editor e download. |
| Editor de prova | Enunciados, alternativas, respostas, objetivos e pontuação; salvar rascunho e confirmar aprovação com indicação da etapa e dos erros. |
| Baixar prova aprovada | PDF, DOCX e gabarito em uma tela compacta; editar novamente ou voltar às provas. Também aparece ao reabrir uma prova aprovada. |
| Modelos de prova | Upload Word/PDF, processamento, prévia e ajuste do cabeçalho PDF. |
| Compartilhamentos | Convites recebidos/enviados; aceitar cópia ou cancelar convite pendente. |
| Sobre | Resumo do funcionamento e das tecnologias, sem controles de tema nesta versão. |

O botão voltar do navegador restaura a tela anterior. Alterações de dados são confirmadas pela API; erros são apresentados ao professor, sem simular sucesso.

## 3.4 Importação de alunos

O modelo XLSX contém nome, nível atual, dificuldades/objetivos e critérios específicos. O nome é obrigatório e o nível vazio assume Intermediário. A aba Alunos e seus quatro cabeçalhos devem ser preservados. São aceitos até 500 alunos por arquivo de até 5 MB; XLS, CSV e fórmulas não integram este fluxo.

O professor escolhe uma turma ativa, envia a planilha, confere a prévia e confirma. O servidor valida novamente e grava o lote em transação. Nomes repetidos impedem a importação; homônimos exigem conferência e cadastro manual. A sequência de códigos considera também alunos arquivados. Não há mesclagem automática com registros existentes.

Importar uma planilha cria registros na turma do destinatário; não concede acesso à turma original de outro professor. O compartilhamento pelo site também cria cópias independentes após aceite.

## 3.5 Materiais e pesquisa externa

O painel Conteúdo para as provas recebe até cinco arquivos de até 20 MB cada, com limite agregado de 60.000 caracteres de texto. A extração ocorre uma vez no envio, e o professor pode conferir o conteúdo lido. Não há OCR para imagens e PDFs digitalizados. Animações avançadas, vídeos e elementos complexos de PowerPoint podem não ser interpretados; recomenda-se uma versão simples com texto selecionável.

Com anexos e pesquisa externa desativada, as questões devem se apoiar no texto extraído. Ao habilitar a pesquisa, podem surgir questões além dos materiais, dentro da matéria e dos tópicos solicitados. Sem anexos, o fluxo original continua disponível. Materiais e preferência ficam registrados no rascunho preparado; alterações posteriores valem para novas provas. Os anexos são privados e não acompanham cópias compartilhadas.

Reaproveitar a leitura dos anexos não significa reaproveitar questões: cada geração solicita conteúdo novo e confere enunciados repetidos dentro do conjunto comparado pelo sistema. Essa conferência não garante unicidade semântica universal e não dispensa revisão docente.

## 3.6 Indicadores e calendário

O painel oferece períodos de um, três ou doze meses, encerrados no mês escolhido. Conta provas que possuem questões pela data de criação no fuso America/Sao_Paulo; rascunhos vazios não entram, edições não contam novamente e provas excluídas deixam o total. Aprovações refletem o estado atual das provas desse período; alunos e turmas ativos representam totais atuais.

O calendário distingue dias sem provas e faixas de 1–2, 3–5, 6–10 e 11 ou mais, com intensidade crescente. Gráficos têm tabela equivalente e as animações respeitam movimento reduzido. O consumo inclui chamadas reais de geração, revisão e pesquisa, inclusive tentativas; dados não informados aparecem como desconhecidos. O histórico anterior à medição não é estimado e tokens não são convertidos em valores de cobrança. O perfil permanece sem envio de foto.

## 3.7 Revisão, aprovação e documentos

O professor revisa o conteúdo e escolhe Salvar rascunho ou Revisei e aprovo. A aprovação salva primeiro o conteúdo e envia uma segunda requisição apenas para confirmar o status. A interface só anuncia sucesso quando o servidor devolve a mesma prova como aprovada. Nesse momento, abre uma tela compacta com PDF, DOCX e gabarito, sem exigir rolagem pelo editor. Editar o conteúdo exige nova aprovação antes de exportar.

Durante a gravação, a interface informa se está salvando a revisão ou confirmando a aprovação. Cada uma dessas requisições tem limite de espera de 60 segundos. Se não houver resposta, a revisão permanece na tela e o professor recebe um aviso: o servidor pode ter concluído a operação, pois interromper a espera no navegador não desfaz a gravação. Erros recebem foco para ficarem visíveis no editor.

A preparação antecipada continua em fila própria. Os botões não dependem da conclusão dessa preparação; um download solicitado pode aproveitar um arquivo pronto ou aguardar a conversão necessária. Durante uma geração ou um download em andamento, novas operações conflitantes permanecem bloqueadas. Isso não constitui garantia de conversão instantânea.

Nos arquivos destinados ao aluno, o título cadastrado serve à organização no site e não é acrescentado ao documento. Modelos Word deixam de receber esse título nos campos vazios de Tema/Título reconhecidos pelo sistema. O cabeçalho do modelo, a identificação, as instruções, as questões, as fórmulas e os espaços de resposta mantêm suas regras anteriores; o cabeçalho permanece apenas na primeira página. O gabarito mantém sua identificação própria. Textos já presentes na imagem do cabeçalho ou no modelo original não são removidos automaticamente. A nova versão do cache evita reutilizar exportações antigas com o título; arquivos já baixados não são alterados.

# 4. REQUISITOS TÉCNICOS DO PROJETO

| Elemento | Tecnologia / responsabilidade |
| --- | --- |
| Linguagens | PHP 8.3+ no backend; TypeScript/JavaScript na interface e no conversor. |
| Framework backend | Laravel 13: rotas, middleware, sessão, validação, Eloquent, autorização, serviços, fila e tarefas agendadas. |
| Interface | React 19, Vite e página de entrada Blade. O frontend consome somente a API Laravel de mesma origem. |
| Banco de dados | SQLite no desenvolvimento/testes e PostgreSQL na AWS em produção. Supabase permanece como referência da migração anterior. |
| Arquivos | Storage privado Laravel; Node 24 para PDF/DOCX e leitura de materiais; LibreOffice para conversões e fila própria de documentos. |
| Planilhas e matemática | OpenSpout para importação XLSX; Python/SymPy para conferência matemática delimitada; KaTeX e equações nativas no Word. |
| Controle de versão | Git e GitHub; migrations, lockfiles e workflow de validação. Segredos não pertencem ao repositório. |
| Serviços externos | SMTP para código de acesso; Gemini principal, Groq de reserva e Mistral opcional. Drive não integrado. |
| Publicação | AWS com Docker, PHP-FPM, Nginx, PostgreSQL, disco persistente, workers e agendador. Vercel como entrada HTTPS; CI e atualização automatizada da origem. |

## 4.1 Modelo de dados e arquitetura

Um professor possui turmas, alunos, provas e modelos. Cada aluno pertence a uma turma; cada prova referencia aluno, turma e, opcionalmente, modelo. Materiais e preferências pertencem à turma; rascunhos preservam a versão das fontes usada na preparação. Lotes registram progresso e reserva de execução; convites armazenam uma fotografia dos dados a copiar; exclusões registram motivo e data. Eventos de consumo registram provedor, etapa, tokens disponíveis, duração e status, sem guardar prompts ou respostas.

Fluxo técnico: navegador → rotas/middleware Laravel → controllers e serviços → Eloquent/banco e storage privado. O worker processa a fila e chama os provedores de IA. O serviço de documentos aciona o conversor auxiliar; esse processo não autentica usuários nem fornece API própria.

## 4.2 Segurança e privacidade

A sessão é mantida por cookie HttpOnly, com CSRF nas escritas e verificações de proprietário no servidor, inclusive na importação, nos materiais e nas métricas. Chaves de IA, SMTP e banco ficam no ambiente privado. O gerador seleciona campos pedagógicos e não inclui os campos de nome/e-mail do aluno; textos livres e anexos podem conter dados que o professor inseriu e devem ser conferidos antes do envio. O material gerado exige revisão humana. Há validações de tamanho, formato e estrutura em leitores de planilhas e materiais; elas não equivalem a isolamento completo do conversor nem a uma auditoria de segurança integral.

# 5. IDEIAS FUTURAS (BACKLOG)

| Código | Proposta |
| --- | --- |
| B01 | Integrar Google Drive para arquivos por proprietário/ano/mês, com autenticação e autorização apropriadas. |
| B02 | Configurar e validar a reserva de geração em produção, acompanhar indisponibilidade/cotas e melhorar recuperação de falhas transitórias. |
| B03 | Ampliar limites de expansão e isolamento de CPU, memória e rede do conversor, cobrindo também dependências e caminhos de exportação. |
| B04 | Medir tempo de upload/geração/exportação, monitorar cotas e estabelecer metas de desempenho com dados reais. |
| B05 | Ampliar acessibilidade com avaliação assistiva e incluir métricas pedagógicas, mediante requisitos definidos pela equipe. |
| B06 | Criar ajustes funcionais de tema claro/escuro; avaliar envio de foto de perfil em entrega futura. |

## 5.1 Validação e critérios de entrega

Os relatórios existentes registram testes automatizados de autenticação, isolamento entre contas, ciclo de vida das turmas, cópias independentes, importação XLSX, materiais, regras das provas, fallback simulado, filas, exportação, matemática e indicadores. Também foram verificados tipos TypeScript, build e navegação responsiva. O relatório da área do professor de 23/11 registra 91 testes PHP com 678 verificações, 63 testes Node e 17 cenários de navegação; são resultados daquela execução, não uma nova execução desta revisão documental.

Na validação de 25/11, a tela de downloads passou por 20 cenários de navegador com API simulada, incluindo revisão longa em desktop e celular, recusa de aprovação, reabertura e edição. A retirada do título foi validada por 68 testes de frontend, 103 testes PHP com 755 verificações, checagem TypeScript e build. Dois testes do conversor foram reexecutados após incluir a verificação de ausência do título no PDF; os cenários preservam o cabeçalho e as questões. O build mantém um aviso sobre bundle superior a 500 kB. A execução local do backend exigiu instalar uma dependência já registrada no lockfile e preparar a configuração de testes; ao final, não houve falhas.

Os registros de publicação confirmam implantação na AWS, migrações e presença dos painéis no site. Testes com respostas simuladas não comprovam disponibilidade ou precisão contínua dos provedores. A falha HTTP 503 e a reserva não configurada correspondem à última inspeção operacional citada, sem nova comprovação de resolução nesta revisão. O responsável confirmou o funcionamento da aprovação em 25/11; os testes locais não medem a latência da VM nem certificam todas as provas reais. Esta revisão altera documentação e PDFs, sem mudar código funcional, banco ou produção.

## 5.2 Documentação complementar

O repositório inclui [README](../README.md), [guia técnico](GUIA-TECNICO.md), [mapa do código](MAPA-DO-CODIGO.md), [histórico de migração](MIGRACAO-LARAVEL.md), [modelos e exportações](PDF-E-ARQUIVOS.md), [verificação matemática](VERIFICACAO-MATEMATICA.md) e [segurança](SEGURANCA.md). Os relatórios em docs/relatorios registram resultados datados. Os dois PDFs de especificação são cópias da mesma revisão deste Markdown, evitando capas e conteúdos divergentes.

As alterações recentes estão detalhadas nos relatórios de [revisão e downloads](relatorios/2026-11-25-revisao-downloads.md) e [provas sem título impresso](relatorios/2026-11-25-provas-sem-titulo.md). A confirmação posterior do responsável sobre a aprovação complementa a limitação de inspeção do navegador registrada no primeiro relatório.

## Referências técnicas

Laravel. Documentação de implantação, versão 13. Disponível em: https://laravel.com/docs/13.x/deployment. Consulta em 10/11/2026.

Supabase. Securing your API. Disponível em: https://supabase.com/docs/guides/api/securing-your-api. Consulta em 10/11/2026.
