# Documento de especificação — Provaai

Instituto Federal de Educação, Ciência e Tecnologia do Tocantins — Campus Paraíso do Tocantins
Curso de Bacharelado em Sistemas de Informação
Disciplina: Linguagens e Técnicas de Programação III
Professor: [Nome do professor]
Equipe: [Nome completo do integrante 1], [Nome completo do integrante 2], [Nome completo do integrante 3], [Nome completo do integrante 4]
Paraíso do Tocantins — 2026

# 1. HISTÓRICO DE ALTERAÇÕES

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 10/11/2026 | 2.0 | Especificação da versão Laravel, preservando as funções do Provaai e registrando pendências de publicação. | Equipe [identificar] |

# 2. DEFINIÇÃO DO PROJETO

## 2.1 Tema

Tecnologia educacional: organização de turmas e preparação de avaliações personalizadas para apoiar o trabalho de professores.

## 2.2 Objetivo do software

O Provaai busca reduzir o trabalho repetitivo de organizar perfis de alunos e elaborar versões de provas adequadas às necessidades pedagógicas de cada turma. Seu público principal é o professor, que informa matéria, tópicos, dificuldades e critérios, revisa as questões sugeridas e aprova o material antes de exportá-lo.

A aplicação reúne turmas, alunos, modelos e histórico de avaliações em um ambiente web. A IA atua como apoio à elaboração; o professor mantém a decisão sobre conteúdo, adequação e uso da prova. O compartilhamento cria cópias editáveis, preservando a independência de cada conta.

## 2.3 Delimitação e situação da entrega

O backend foi migrado para Laravel para atender ao requisito da disciplina. A interface React foi mantida. A implementação e os testes descritos referem-se ao ambiente local; a transferência dos dados reais e a publicação dependem de homologação. A integração com Google Drive está planejada e não integra esta entrega funcional.

Os nomes do professor e dos integrantes não foram fornecidos. Os campos da capa devem ser completados pela equipe antes da entrega acadêmica.

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
