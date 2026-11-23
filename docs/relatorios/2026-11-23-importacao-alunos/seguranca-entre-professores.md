# Importação em turma existente e isolamento entre professores

Data: 23/11/2026. Revisão local, sem staging, commit, push ou publicação.

## Acesso dentro da turma

O código já oferece **Importar alunos** no cartão e na página de cada turma,
com destino fixo, download do modelo, seleção do arquivo e prévia. O Excel
preenchido acrescenta novos alunos à turma existente, sem recriá-la e sem
substituir os alunos que já estão nela. Os códigos são atribuídos pelo servidor.
O arquivo é processado para cadastro, não mantido como anexo permanente.

Na consulta HTTP pública desta execução, `https://provaai.vercel.app` serviu
`/build/assets/app-ehPYGwen.js`, contendo tanto `/api/students/import` quanto
`import-students`. O modelo `/modelos/modelo-alunos.xlsx` retornou **200**.
Isso difere da consulta anterior registrada em `acesso-nas-turmas.md`, quando
a versão publicada ainda não continha o recurso. O estado local inicial estava
limpo no commit `6bd21ae` (`Nova importação`).

A captura enviada pelo usuário não mostra o botão. A evidência atual confirma
a presença do recurso nos arquivos públicos, mas não prova qual versão estava
carregada naquela sessão. Atualizar completamente a página é a primeira ação
para carregar a versão atual. Não foi acessada a conta real do usuário.

## Regra de privacidade conferida

- Cada professor consulta e altera apenas os registros associados à sua sessão.
  Informar IDs ou `user_id` de outra conta não concede permissão.
- Importar um Excel recebido por fora do site cria registros independentes na
  turma do professor autenticado. O arquivo não autoriza consultar ou alterar
  a turma original. A aplicação não consegue verificar quem forneceu um arquivo
  externo nem se ele foi realmente editado; valida seu conteúdo e o destino.
- **Compartilhar cópia** exige que o remetente seja proprietário. Somente a
  conta com o e-mail destinatário pode aceitar. A turma ou o perfil recebido
  passa a ser uma cópia independente, sem permissão sobre a origem.
- O remetente também não ganha acesso à cópia do destinatário. Alterações
  posteriores em uma cópia não afetam os registros originais.
- Compartilhar um aluno permite selecionar uma turma existente do destinatário.
  Compartilhar a turma inteira cria outra turma na conta destinatária, conforme
  o comportamento já existente. Nenhuma dessas opções cria edição conjunta.
- Convites cancelados não podem ser aceitos. Depois do aceite, o cancelamento
  não revoga nem apaga a cópia já recebida.

Foi acrescentada essa explicação ao formulário de importação para deixar claro
que enviar a planilha não abre acesso à turma de outro professor.

## Revisão do backend e correções

Foram conferidos `RecordsController`, `StudentImportController`,
`ActionsController`, `DocumentsController`, os escopos de propriedade,
`OwnedPolicy`, as rotas autenticadas e os vínculos usados por geração/lotes.
As permissões são aplicadas no servidor; não dependem de esconder botões.

1. **Cancelamento versus aceite do convite:** o aceite bloqueava o convite,
   mas o cancelamento só tinha o bloqueio da conta do remetente. Como remetente
   e destinatário são contas diferentes, esses bloqueios não serializavam as
   duas operações. O cancelamento agora valida o UUID e usa `lockForUpdate`
   no mesmo convite antes de verificar o aceite e salvar a revogação, dentro
   da transação existente. Isso serializa os estados em bancos com bloqueio
   de linha, como PostgreSQL/MySQL.
2. **Resposta da geração para ID alheio:** a busca por proprietário já barrava
   acesso, mas `ModelNotFoundException` caía no tratamento genérico de
   `RuntimeException`, devolvendo 502 com detalhes da exceção. Agora o caso
   mantém a resposta 404 padrão, igual a um registro inexistente. Não foi
   identificada leitura de conteúdo alheio nesse caminho.

## Testes executados

| Comando | Resultado final |
| --- | --- |
| `php artisan test` | 72 testes, 532 asserções, todos aprovados |
| `npm run typecheck` | Aprovado |
| `npm test` | 54 testes aprovados |
| `npm run build` | Aprovado; aviso de chunk maior que 500 kB |
| `node --experimental-strip-types tests/browser/student-import.mjs` | Aprovado em 1440 e 375 pixels |
| `git diff --check` | Sem erros de whitespace |

Nova suíte `TeacherIsolationTest`, com três contas fictícias, cobre:

- Listagens, busca por ID, filtro de proprietário forjado e edição de turmas e
  alunos de outra conta.
- Cadastro em turma alheia, arquivamento, exclusão, transferência/reativação,
  inclusão no acompanhamento individual e compartilhamento sem propriedade.
- Convites invisíveis a terceiros, recusa de aceite/cancelamento por quem não
  tem permissão e ocultação do snapshot na resposta da lista de convites.
- Aceite só pelo destinatário, impossibilidade de escolher destino alheio,
  bloqueio de convite revogado e conflito ao cancelar convite já aceito.
- Independência dos alunos copiados e isolamento em ambos os sentidos após
  compartilhar, inclusive edição de cópia sem alterar o original.
- Provas, modelos, exportação, geração, processamento de modelo, leitura e
  exclusão de arquivo e progresso de download de outra conta.

Novo cenário em `StudentImportTest` importa uma lista Excel editada para uma
turma já existente, confere novo código e proprietário, recusa prévia e envio
para turma alheia, ignora tentativas de forjar `user_id`/`student_id`, mantém
o original intacto e confirma que nenhuma turma adicional foi criada.

O teste de navegador já existente foi executado no build final: Alunos,
cartão da turma e página interna; destino correto, prévia, confirmação,
atualização de contador/lista, turma inativa e histórico. API simulada no
navegador; endpoint real e banco isolado nos testes PHP. Capturas atualizadas
ficam neste diretório; a prévia desktop foi conferida visualmente.

Na primeira execução, a suíte nova revelou a resposta 502 descrita acima.
Também foi removida uma asserção incorreta do teste que considerava inválido
um e-mail sintaticamente válido. A suíte completa foi repetida após os ajustes.

## Ambiente e limites

PHP: `C:/Users/R3/.cache/provaai-tools/php83/php.exe`.
Npm: `node C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`.
Na suíte PHP, `PYTHON_BINARY` apontou para
`C:/Users/R3/.cache/provaai-tools/math-docs-venv/Scripts/python.exe`,
`NODE_BINARY` para o Node disponível e o diretório do PHP foi acrescentado ao
PATH. Navegador: Edge headless isolado com Playwright do runtime instalado.

Os testes de banco usam SQLite em memória. Os estados sequenciais de aceite
e cancelamento foram testados; a corrida entre processos em PostgreSQL/MySQL
não foi reproduzida neste host. A revisão cobre os fluxos descritos e não é
uma garantia absoluta contra toda vulnerabilidade, nem uma auditoria da
infraestrutura, das credenciais ou da configuração real de produção.

As correções desta execução e a nova explicação estão locais para revisão e
commit pelo usuário. Não houve alteração em contas reais, envio de convites
reais ou publicação das correções de segurança.
