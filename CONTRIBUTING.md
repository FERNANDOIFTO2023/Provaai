# Como contribuir

As alteracoes de colaboradores entram na `main` por pull request (PR), depois
da revisao do proprietario e das validacoes automaticas. Commits em branches
de trabalho continuam livres; push direto, force push e exclusao da `main`
sao bloqueados para colaboradores. A conta proprietaria `@FERNANDOIFTO2023`
tem liberacao total, conforme descrito abaixo.

## Fluxo do colaborador

1. Atualize sua copia da `main` e crie uma branch para a tarefa.
2. Faca os commits nessa branch e envie-a ao GitHub. Quem nao tem permissao
   de escrita pode contribuir por um fork.
3. Abra um PR para `main`, descrevendo a mudanca e como foi validada.
4. Aguarde a aprovacao de `@FERNANDOIFTO2023`, responsavel por todos os arquivos
   em `.github/CODEOWNERS`.
5. Resolva os comentarios e mantenha a branch atualizada com a `main`.
   Novos commits invalidam as aprovacoes anteriores e exigem nova revisao.
6. Com a aprovacao, as conversas resolvidas e os testes aprovados, o GitHub
   integra o PR automaticamente por squash, reunindo a mudanca em um commit.

PRs em rascunho nao ativam a integracao automatica. O workflow
`.github/workflows/auto-merge.yml` agenda a integracao ao abrir, reabrir,
atualizar ou marcar um PR como pronto. Ele nao executa codigo do PR nem
ignora as protecoes. Se a automacao falhar ou for desativada, use **Enable
auto-merge** no PR; os mesmos requisitos continuam obrigatorios.

## Validacoes obrigatorias

O agente prepara as alteracoes, executa e confere os testes relevantes e
entrega um relatorio em `docs/relatorios/`. **Por padrao, somente o usuario
faz o commit.** O agente so pode fazer staging, criar commits, enviar pushes
ou integrar PRs quando o usuario autorizar explicitamente a operacao e o
escopo atuais. A autorizacao nao vale para tarefas futuras e nao dispensa
testes nem relatorio antes do commit. Essa regra esta registrada em
`AGENTS.md` e vale mesmo com o bypass do GitHub. Falhas e testes que nao
puderam ser executados devem ser descritos no relatorio; o trabalho nao
deve ser apresentado como validado nesses casos.

- `validate`: verificacao de tipos, testes do frontend, build, testes Laravel
  e testes do verificador matematico.
- `migration`: construcao Docker, migracoes PostgreSQL e verificacao da
  importacao de dados e da conversao de documentos.

Os resultados devem vir do GitHub Actions. A branch precisa estar atualizada
com a `main` para que os testes considerem as mudancas mais recentes.
Esses testes reduzem regressões, mas nao substituem a revisao do codigo.

## Regras e responsabilidade do proprietario

As configuracoes estao documentadas em `.github/rulesets/` e precisam estar
ativas em **Settings > Rules > Rulesets**. Editar os arquivos JSON, por si so,
nao altera as regras do GitHub.

- **main - integridade e testes**: exige PR, conversas resolvidas e os dois
  testes; bloqueia force push e exclusao para colaboradores.
- **main - aprovacao do proprietario**: exige a aprovacao do CODEOWNER e uma
  revisao posterior ao ultimo envio para contribuicoes de colaboradores.

Somente a conta `@FERNANDOIFTO2023` tem bypass permanente nos dois conjuntos
de regras. Ela pode enviar commits diretamente para a `main`, concluir PRs
sem revisao ou testes obrigatorios, fazer force push e excluir a branch.
Os workflows de testes continuam rodando, mas nao bloqueiam essa conta.
A excecao usa a identidade autenticada no GitHub, e nao o nome ou o e-mail
gravado no commit; um colaborador nao ganha a excecao ao copiar esses dados.

Colaboradores devem receber apenas permissao de escrita, sem administracao.
Quem administra o repositorio pode alterar ou remover as protecoes.
