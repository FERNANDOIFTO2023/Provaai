# Documento de especificação — Provaai

Instituto Federal de Educação, Ciência e Tecnologia do Tocantins — Campus Paraíso do Tocantins
Curso de Bacharelado em Sistemas de Informação
Disciplina: Linguagens e Técnicas de Programação III
Professor: Marcos Raimundo
Equipe: Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg
Paraíso do Tocantins — 2026

# 1. HISTÓRICO DE ALTERAÇÕES

O quadro reúne as principais mudanças de escopo, interface e implementação até 11/11/2026. Os registros anteriores à migração foram agrupados por período de desenvolvimento. A indicação 1.x identifica essa fase do projeto, sem atribuir um número de lançamento a cada ajuste. A versão 2.0 corresponde à migração para Laravel e às correções posteriores.

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

Responsáveis pelo projeto: Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg. O quadro registra as entregas do projeto de forma conjunta, sem atribuir tarefas individuais não documentadas.

As seções seguintes preservam a base da especificação de 10/11/2026. As entradas de 11/11 registram a evolução posterior, inclusive a publicação na AWS e os testes de integração que estavam pendentes naquela data.

# 2. DEFINIÇÃO DO PROJETO

## 2.1 Tema

Tecnologia educacional: organização de turmas e preparação de avaliações personalizadas para apoiar o trabalho de professores.

## 2.2 Objetivo do software

O Provaai busca reduzir o trabalho repetitivo de organizar perfis de alunos e elaborar versões de provas adequadas às necessidades pedagógicas de cada turma. Seu público principal é o professor, que informa matéria, tópicos, dificuldades e critérios, revisa as questões sugeridas e aprova o material antes de exportá-lo.

A aplicação reúne turmas, alunos, modelos e histórico de avaliações em um ambiente web. A IA atua como apoio à elaboração; o professor mantém a decisão sobre conteúdo, adequação e uso da prova. O compartilhamento cria cópias editáveis, preservando a independência de cada conta.

## 2.3 Delimitação e situação da entrega

O backend foi migrado para Laravel para atender ao requisito da disciplina. A interface React foi mantida. A implementação e os testes descritos referem-se ao ambiente local; a transferência dos dados reais e a publicação dependem de homologação. A integração com Google Drive está planejada e não integra esta entrega funcional.

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
| RF013 | Exportar provas aprovadas em PDF ou DOCX, com gabarito opcional. Alterações relevantes exigem nova aprovação. |
| RF014 | Organizar provas por mês/ano e permitir retornar à tela anterior pelo botão do navegador. |

## 3.2 Requisitos não funcionais (RNF)

| Código | Requisito |
| --- | --- |
| RNF001 | Utilizar obrigatoriamente Laravel no backend, com rotas, regras, autenticação e persistência implementadas em PHP. |
| RNF002 | Restringir dados e arquivos ao professor autenticado; verificar também os proprietários das referências entre registros. |
| RNF003 | Manter credenciais privadas no servidor, fora do repositório e do bundle do navegador; usar HTTPS e cookies seguros na publicação. |
| RNF004 | Validar entradas e saídas, proteger operações com CSRF e limitar tentativas de autenticação. |
| RNF005 | Aplicar transações, chaves estrangeiras e unicidade para preservar vínculos e evitar códigos duplicados. |
| RNF006 | Manter arquivos privados fora da raiz pública, com upload máximo de 20 MiB e respostas de download sem cache público. |
| RNF007 | Reduzir processamento repetido por cache privado de cinco minutos e fila no servidor. Latência deve ser medida em homologação, sem prazo artificial prometido. |
| RNF008 | Oferecer interface responsiva, controles identificados, feedback de erros/progresso e organização consistente das telas. |
| RNF009 | Versionar código e migrações, manter testes automatizados, documentação de operação e backups de banco/arquivos. |
| RNF010 | Preservar revisão humana: a IA auxilia o professor, não aprova automaticamente avaliações ou decisões pedagógicas. |

Os requisitos descrevem o comportamento implementado ou o critério de operação. Aspectos dependentes de infraestrutura, carga e acessibilidade assistiva exigem homologação; não se presume aprovação apenas pela existência do código.

## 3.3 Modelagem das funcionalidades e telas

Representação esquemática do fluxo principal da aplicação. As caixas abaixo são um modelo de navegação, não capturas de tela.

Fluxo: Acesso → Minhas turmas → Alunos/modelos → Gerar em fila → Revisar/aprovar → Exportar PDF/DOCX.

| Tela | Conteúdo e ações |
| --- | --- |
| Acesso | E-mail → código → área do professor; mensagens de prazo e reenvio. |
| Minhas turmas | Busca/status, cartões de turmas, cadastro e edição de aparência. |
| Detalhe da turma | Lista de alunos, perfis, configurações, inativação/exclusão e preparação de provas. |
| Alunos | Busca, filtros de status e turma, reativação e compartilhamento de cópia. |
| Provas coletivas / individuais | Histórico por mês, acompanhamento do lote, abertura do editor e download. |
| Editor de prova | Enunciados, alternativas, respostas, objetivos e pontuação; salvar, aprovar e exportar. |
| Modelos de prova | Upload Word/PDF, processamento, prévia e ajuste do cabeçalho PDF. |
| Compartilhamentos | Convites recebidos/enviados; aceitar cópia ou cancelar convite pendente. |

O botão voltar do navegador restaura a tela anterior. Alterações de dados são confirmadas pela API; erros são apresentados ao professor, sem simular sucesso.

# 4. REQUISITOS TÉCNICOS DO PROJETO

| Elemento | Tecnologia / responsabilidade |
| --- | --- |
| Linguagens | PHP 8.3+ no backend; TypeScript/JavaScript na interface e no conversor. |
| Framework backend | Laravel 13: rotas, middleware, sessão, validação, Eloquent, autorização, serviços, fila e tarefas agendadas. |
| Interface | React 19, Vite e página de entrada Blade. O frontend consome somente a API Laravel de mesma origem. |
| Banco de dados | SQLite no desenvolvimento/testes. PostgreSQL previsto para produção, inclusive no Supabase em schema privado. |
| Arquivos | Storage privado controlado pelo Laravel. Conversor Node 24 para PDF/DOCX; cache de resultados e arquivos temporários. |
| Controle de versão | Git e GitHub; migrations, lockfiles e workflow de validação. Segredos não pertencem ao repositório. |
| Serviços externos | SMTP para código de acesso; Gemini principal, Groq de reserva e Mistral opcional. Drive não integrado. |
| Publicação | Servidor PHP/Node com HTTPS, disco persistente, worker e agendador. Dockerfile fornecido, ainda sem validação da imagem neste ambiente. |

## 4.1 Modelo de dados e arquitetura

Um professor possui turmas, alunos, provas e modelos. Cada aluno pertence a uma turma; cada prova referencia aluno, turma e, opcionalmente, modelo. Preferências de modelo e acompanhamento individual complementam os cadastros. Lotes registram progresso e reserva de execução; convites armazenam uma fotografia dos dados a copiar; exclusões de turma registram motivo e data.

Fluxo técnico: navegador → rotas/middleware Laravel → controllers e serviços → Eloquent/banco e storage privado. O worker processa a fila e chama os provedores de IA. O serviço de documentos aciona o conversor auxiliar; esse processo não autentica usuários nem fornece API própria.

## 4.2 Segurança e privacidade

A sessão é mantida por cookie HttpOnly, com CSRF nas escritas e verificações de proprietário no servidor. Chaves de IA, SMTP e banco ficam no ambiente privado. O gerador envia o perfil pedagógico necessário, sem nome/e-mail do aluno. O material gerado exige revisão humana. A análise de recursos consumidos por DOCX permanece como pendência documentada, sem alegação de auditoria completa.

# 5. IDEIAS FUTURAS (BACKLOG)

| Código | Proposta |
| --- | --- |
| B01 | Integrar Google Drive para arquivos por proprietário/ano/mês, com autenticação e autorização apropriadas. |
| B02 | Concluir homologação de hospedagem PHP, SMTP, provedores de IA, PostgreSQL e imagem Docker; migrar os dados reais e publicar. |
| B03 | Adicionar limites efetivos de expansão DOCX e isolamento de recursos do conversor; validar em ambiente descartável. |
| B04 | Medir tempo de upload/geração/exportação, monitorar cotas e estabelecer metas de desempenho com dados reais. |
| B05 | Ampliar acessibilidade com avaliação assistiva e incluir métricas pedagógicas, mediante requisitos definidos pela equipe. |

## 5.1 Validação e critérios de entrega

Foram executados testes automatizados de autenticação, isolamento entre contas, ciclo de vida das turmas, cópias independentes, regras das provas, fallback de IA simulado, fila, documentos reais e ferramentas de migração. Também foram verificados tipos TypeScript, build da interface e login/retorno entre telas no navegador local.

As verificações não comprovam funcionamento de SMTP real, disponibilidade/cotas dos modelos, desempenho em produção, implantação Docker ou migração de dados reais. Esses itens devem ser homologados antes do corte do site. Nenhum dado do ambiente publicado foi removido ou transferido nesta alteração.

## 5.2 Documentação complementar

O repositório inclui README, guia técnico, procedimento de migração, descrição de modelos PDF/Word e relatório de segurança. Os documentos distinguem funcionalidades atuais de propostas e preservam o registro histórico da revisão de segurança anterior.

## Referências técnicas

Laravel. Documentação de implantação, versão 13. Disponível em: https://laravel.com/docs/13.x/deployment. Consulta em 10/11/2026.

Supabase. Securing your API. Disponível em: https://supabase.com/docs/guides/api/securing-your-api. Consulta em 10/11/2026.
