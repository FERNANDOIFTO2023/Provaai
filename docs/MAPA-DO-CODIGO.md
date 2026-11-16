# Mapa do código para manutenção

Este roteiro complementa os comentários em português dos arquivos. Para instalar e configurar a aplicação, consulte o [guia técnico](GUIA-TECNICO.md). Para preparar uma alteração e entregá-la para commit, siga [AGENTS.md](../AGENTS.md) e [CONTRIBUTING.md](../CONTRIBUTING.md).

Os comentários explicam a responsabilidade do módulo, o caminho dos dados e as regras que precisam continuar válidas. Os arquivos maiores também possuem setores internos. Nomes de funções, rotas, campos, tipos, identificadores dos testes e diretivas de ferramentas foram preservados para manter compatibilidade.

## 1. Entrada e interface

O Nginx encaminha a requisição ao [public/index.php](../public/index.php). O Laravel carrega [bootstrap/app.php](../bootstrap/app.php) e [routes/web.php](../routes/web.php). A view [app.blade.php](../resources/views/app.blade.php) fornece o elemento `app`, os metadados e o token CSRF.

[resources/js/app.tsx](../resources/js/app.tsx) monta o React, carrega os estilos e envolve a aplicação no provedor de movimento. [TeacherApp](../components/teacher-app.tsx) decide entre entrada, demonstração e área autenticada.

[TeacherWorkspace](../components/teacher-workspace.tsx) coordena as telas. Os setores comentados seguem esta organização:

| Setor | Responsabilidade | Ao alterar |
| --- | --- | --- |
| 1. Estado | Dados carregados, seleção, busca e rascunhos | Diferencie o registro salvo do conteúdo ainda em edição. |
| 2. Navegação e operações | Histórico, carregamento, geração e downloads | Diálogos não devem reaparecer como páginas ao usar Voltar. |
| 3. Persistência e cadastros | Turmas, capas, alunos e preferência de modelo | A resposta do backend confirma o que foi salvo. |
| 4. Provas | Preparação manual ou com IA, revisão e aprovação | Conteúdo editado precisa ser salvo como rascunho antes de nova aprovação. |
| 5. Modelos | Envio, leitura e atualização da coleção | Arquivo salvo com falha de leitura pode ser processado novamente. |
| 6. Ciclo de vida | Arquivamento, reativação e convites de cópia | Preservar histórico e conferir a propriedade dos destinos. |
| 7. Composição visual | Navegação, telas e diálogos em JSX | Reutilize os callbacks de negócio dos setores anteriores. |

As telas de alunos, provas coletivas, provas individuais e modelos estão em componentes próprios. Elas recebem dados e callbacks; a autorização definitiva não é feita pela visibilidade de um botão.

## 2. Navegação, sessão e tarefas

| Arquivo | O que controla |
| --- | --- |
| [use-workspace-history.ts](../components/use-workspace-history.ts) | Histórico por conta, somente com páginas estáveis; fechamento retorna à origem do diálogo. |
| [use-idle-session.ts](../components/use-idle-session.ts) | Eventos do usuário, sincronização entre abas e saída por inatividade. |
| [idle-session.ts](../lib/idle-session.ts) | Prazos e regras puras do relógio, com alternativa em memória se o armazenamento falhar. |
| [use-exam-batch.ts](../components/use-exam-batch.ts) | Consulta do lote persistido e solicitação de retomada quando a reserva expira. |
| [use-template-queue.ts](../components/use-template-queue.ts) | Fila local de modelos, até dois trabalhos simultâneos e cancelamento na desmontagem. |
| [use-exam-download.ts](../components/use-exam-download.ts) | Estado do download e prevenção de operações duplicadas. |

O marcador chamado `access_token` existe por compatibilidade do cliente e identifica o relógio de atividade. A credencial de autenticação é o cookie HttpOnly do Laravel. Não use esse marcador para autorizar acesso a dados.

## 3. API, validações e propriedade

[api-client.ts](../lib/api-client.ts) adapta consultas encadeadas para a API Laravel. `from(...).select(...).eq(...)` monta uma requisição; não consulta diretamente o banco nem oferece acesso irrestrito às tabelas. O método `createSignedUrl` mantém o nome anterior, mas retorna uma rota que exige sessão, sem gerar um link público assinado.

| Arquivo | Regra central |
| --- | --- |
| [AuthController](../app/Http/Controllers/AuthController.php) | Emissão e verificação de código, limite de tentativas e criação da sessão. |
| [RecordsController](../app/Http/Controllers/RecordsController.php) | Recursos e campos permitidos, filtros por proprietário e validação de vínculos. |
| [ActionsController](../app/Http/Controllers/ActionsController.php) | Operações compostas sob transação: arquivar, reativar, excluir e copiar. |
| [DocumentsController](../app/Http/Controllers/DocumentsController.php) | Arquivos privados, leitura de modelos e exigência de aprovação para exportar. |
| [OwnedModel](../app/Models/OwnedModel.php) | UUIDs e escopo explícito `ownedBy`; não há filtro global automático de proprietário. |
| [OwnedPolicy](../app/Policies/OwnedPolicy.php) | Autorização complementar pela identidade do proprietário. |

Os convites usam `owner_id` e e-mail do destinatário. Não aplique a eles, sem adaptação, um filtro genérico que pressupõe `user_id`. O aceite cria dados independentes a partir do snapshot enviado; não concede acesso de edição ao original.

Os esquemas Zod em [model.ts](../lib/model.ts) e [exam.ts](../lib/exam.ts) ajudam na interface. O backend repete suas próprias verificações porque requisições podem chegar sem passar pelo formulário.

## 4. Geração e revisão de provas

1. [BatchService](../app/Services/BatchService.php) confere turma, alunos, quantidade e modelo, cria os rascunhos e registra o lote.
2. [GenerateBatchStep](../app/Jobs/GenerateBatchStep.php) obtém uma reserva temporária e processa uma prova.
3. [AiService](../app/Services/AiService.php) prepara contexto pedagógico, chama o provedor, valida a estrutura e solicita conferência de matéria e tópicos.
4. [GeneratedExamContent](../app/Services/GeneratedExamContent.php) resolve apenas seleções explícitas do gabarito. [ExamValidator](../app/Services/ExamValidator.php) rejeita estrutura inválida, duplicações e alternativas inconsistentes.
5. [MathVerificationService](../app/Services/MathVerificationService.php) chama o verificador Python quando a matéria se enquadra no reconhecimento matemático.
6. A prova permanece como rascunho para o professor revisar e aprovar.

`batch_id` distingue execuções e `lease` distingue trabalhadores. Uma resposta atrasada só pode atualizar o lote se ainda corresponder à reserva atual. Ao alterar prazos, confira também o timeout do job, o trabalhador do Supervisor e `DB_QUEUE_RETRY_AFTER`.

Os arquivos [generation.txt](../resources/prompts/generation.txt) e [review.txt](../resources/prompts/review.txt) são instruções enviadas à IA. Não receberam comentários internos: qualquer texto acrescentado ali participa do pedido ao provedor.

## 5. Matemática e documentos

[verify-math.py](../scripts/verify-math.py) interpreta uma lista limitada de nós da AST e usa SymPy para conferir aritmética e equações reais reconhecidas. Não executa o texto recebido como Python. Notação, instruções ou limites não cobertos produzem necessidade de revisão; `verified` se refere ao resultado final conferido, não a toda a adequação pedagógica.

O parecer armazena a entrada que foi verificada. [math-review.ts](../lib/math-review.ts) verifica essa correspondência antes de mostrá-lo como atual após uma edição.

| Etapa | Implementação |
| --- | --- |
| Orquestrar conversão e cache privado | [DocumentService](../app/Services/DocumentService.php) |
| Executar o pedido JSON do PHP | [render-document.mjs](../scripts/render-document.mjs) |
| Recortar somente pixels do cabeçalho PDF | [pdf-header.ts](../lib/pdf-header.ts) |
| Preencher diagramação Word | [docx-layout.ts](../lib/docx-layout.ts) |
| Transformar fórmulas em equações editáveis | [docx-math.ts](../lib/docx-math.ts) |
| Montar layout padrão e ZIP de provas | [export.ts](../lib/export.ts) |
| Receber arquivo e medir a transferência | [download-file.ts](../lib/download-file.ts) |

O processo Node não oferece API HTTP nem acessa o banco. Sua última linha de saída é o JSON lido pelo PHP. Não acrescente mensagens informais depois dessa resposta. Arquivos temporários precisam ser removidos também em falhas.

## 6. Estilos e acessibilidade

Os arquivos em [resources/css](../resources/css) possuem descrição de responsabilidade e marcações nos trechos de responsividade e movimento reduzido. A ordem de importação em `resources/js/app.tsx` faz parte da cascata: `sala.css` fornece a base e os demais arquivos complementam a identidade e áreas específicas.

Ao alterar componentes compartilhados, confira foco de teclado, rótulos acessíveis, leitura em tela pequena e preferência por movimento reduzido. O editor e o cartão da turma usam a mesma geometria de recorte em [class-appearance.ts](../lib/class-appearance.ts).

## 7. Banco, infraestrutura e materiais auxiliares

- [database/migrations](../database/migrations): evolução do banco Laravel. Cada arquivo explica a estrutura afetada e o papel de `up`/`down`.
- [database/legacy-supabase](../database/legacy-supabase): referência histórica comentada; não é a sequência de migrações do banco atual.
- [config](../config): configurações Laravel comentadas em português. Valores específicos da instalação vêm do ambiente.
- [deploy](../deploy), [Dockerfile](../Dockerfile) e [compose.yaml](../compose.yaml): processos, imagem e publicação. A recuperação de imagem no release não reverte migrações do banco.
- [.github/workflows](../.github/workflows): verificações de CI e integração condicionada às proteções. O workflow privilegiado de auto-merge não deve executar código do PR.
- [docs/email](email) e [docs/motion](motion): ferramentas de prévia, captura e geração de mídia; não são carregadas pelo frontend da aplicação.

## 8. Arquivos sem comentários internos

JSON não aceita comentários. Para estes arquivos, use esta referência sem acrescentar campos fictícios de documentação:

| Arquivo | Responsabilidade |
| --- | --- |
| [package.json](../package.json) | Dependências frontend/Node e comandos de desenvolvimento, testes e build. |
| [composer.json](../composer.json) | Dependências PHP, autoload e comandos Composer. |
| [tsconfig.json](../tsconfig.json) | Regras de compilação e resolução de módulos TypeScript. |
| [vercel.json](../vercel.json) | Integração da publicação com a configuração de proxy gerada. |
| [.github/rulesets](../.github/rulesets) | Representações das regras de proteção; alterações locais não atualizam automaticamente o GitHub. |
| [docs/motion/package.json](motion/package.json) | Comandos para gerar os materiais audiovisuais. |

Locks de dependências, `vendor`, `node_modules`, builds, caches, mídias, fixtures e prévias geradas não receberam comentários. Edite seus arquivos de origem ou o gerador correspondente. Os prompts foram preservados como entrada funcional da IA.

## 9. Verificação antes do commit

Os comentários das suítes indicam o comportamento protegido. Execute os comandos exigidos por `AGENTS.md` conforme as camadas afetadas:

```sh
npm run typecheck
npm test
npm run build
php artisan test
python -m unittest discover -s tests/math_verifier
git diff --check
```

Os testes de navegador ficam em `tests/browser`. `PLAYWRIGHT_MODULE` e `CHROME_PATH` permitem indicar a biblioteca e o executável disponíveis na máquina. Eles usam API simulada para testar o build local, sem confirmar entrega de e-mail ou disponibilidade de provedores reais.

Mantenha os comentários próximos da regra que descrevem. Quando uma regra mudar, atualize código, testes e explicação no mesmo trabalho. O agente entrega as alterações e um relatório; commit e publicação exigem autorização específica do usuário.
