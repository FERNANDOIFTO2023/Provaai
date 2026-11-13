# Relatório de validação — proteção da main

Data: 13/11/2026. Repositório: `FERNANDOIFTO2023/Provaai`.

## Resultado e alterações

- Dois rulesets ativos no GitHub exigem PR, revisão, conversas resolvidas e
  os checks `validate` e `migration` para colaboradores; também bloqueiam
  force push e exclusão da `main`.
- Apenas a conta autenticada `FERNANDOIFTO2023` tem bypass permanente de
  todas essas regras. Nome e e-mail do autor do commit não concedem bypass.
- A opção de auto-merge foi habilitada no repositório.
- A entrega para a `main` contém `.github/CODEOWNERS`, os JSONs dos rulesets,
  o workflow de auto-merge e as instruções de contribuição.
- `AGENTS.md` e `CONTRIBUTING.md` registram a orientação final: o agente
  altera, testa e relata; commits e publicação pelo agente exigem autorização
  explícita do usuário para a operação e o escopo atuais. Essa autorização
  não se estende a tarefas futuras e não dispensa testes nem relatório.

## Verificações executadas

| Verificação/comando | Resultado |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | Aprovado, sem erros de tipos. |
| `node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/*.test.mjs tests/*.test.ts` | 52 testes aprovados; zero falhas ou testes ignorados. |
| `node node_modules/vite/bin/vite.js build` | Aprovado. |
| `actionlint.exe -shellcheck= -pyflakes= .github/workflows/auto-merge.yml .github/workflows/validate.yml` | Aprovado com actionlint 1.7.12; sem erros de sintaxe ou expressões dos workflows. |
| Leitura dos JSONs com `ConvertFrom-Json` e conferência de branch, ativação e bypass | Aprovado; somente `main`, regras ativas e apenas o proprietário com bypass `always`. |
| Consulta dos dois rulesets pela API após atualização | Aprovado; estado remoto confirmado. |
| API `codeowners/errors?ref=codex/github-main-protection` | Nenhum erro no CODEOWNERS da branch. |
| `git diff --check` | Aprovado. |
| CI do PR no commit `a39642c` | Aprovado, incluindo frontend, Laravel, verificador matemático, Docker e migração. |

O comando `npm` não estava no PATH; os scripts correspondentes de testes,
tipos e build foram executados diretamente com Node.js. O actionlint foi
baixado da versão oficial e seu SHA-256 foi conferido antes da execução.

Evidência do CI: [execução do PR](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/43424247852)
e [execução do push](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/43424236078),
ambas concluídas com sucesso. Essas execuções validam `a39642c`; a entrega
final acrescenta apenas as instruções e este relatório, sem alterar o código
da aplicação ou os workflows já validados. Os formatos das configurações,
o actionlint e o diff foram conferidos novamente antes do commit autorizado.

## Avisos e limites

- O build avisa sobre um bundle maior que 500 kB. Os testes de PDF emitem
  avisos de fontes e indexação, mas todos os testes passaram.
- O actionlint foi executado sem os validadores externos ShellCheck e
  Pyflakes. O workflow de auto-merge ainda não foi exercitado em um PR real
  com aprovação do proprietário; sua validação nesta entrega é estática.
- PHP não está no PATH local. Os testes Laravel e de migração foram
  confirmados no CI acima; não foram executados localmente nesta tarefa.
- O CODEOWNERS e o workflow de auto-merge passam a valer na branch de
  destino com a publicação destes arquivos na `main`.
- Testes reduzem o risco de regressões; não comprovam ausência de todo bug.

## Publicação autorizada

O usuário autorizou explicitamente o agente a commitar estas regras e
publicá-las diretamente na `main`. O escopo inclui os arquivos de proteção,
as instruções de contribuição e dos agentes e este relatório.

Os commits de configuração `a41922a` e `a39642c`, apresentados no
[PR #1](https://github.com/FERNANDOIFTO2023/Provaai/pull/1), fazem parte desta
entrega. A publicação usa avanço normal do histórico, sem force push.

Regras ativas: [integridade e testes](https://github.com/FERNANDOIFTO2023/Provaai/rules/27199089)
e [aprovação do proprietário](https://github.com/FERNANDOIFTO2023/Provaai/rules/27199090).
