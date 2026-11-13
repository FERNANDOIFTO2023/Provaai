# Instruções para agentes

## Commits são responsabilidade do usuário

- O agente prepara as alterações, executa os testes e entrega um relatório.
  Por padrão, apenas o usuário cria os commits do projeto.
- Não execute `git commit`, `git push`, merges de PRs nem operações de API
  que criem commits ou atualizem branches remotas sem autorização explícita
  do usuário para a operação e o escopo atuais. Sem essa autorização, deixe
  as alterações locais disponíveis para revisão e commit pelo usuário.
- O usuário pode autorizar o agente a commitar e publicar uma mudança
  específica. Essa autorização não se estende a alterações ou tarefas futuras
  e não dispensa os testes e o relatório antes do commit.
- Não faça staging automaticamente, exceto como parte de um commit
  explicitamente autorizado; inclua apenas os arquivos do escopo autorizado.

## Testes e relatório antes da entrega

- Execute e confira os testes relevantes sobre as alterações finais antes
  de entregar o trabalho para commit. Não deixe a validação apenas para o CI.
- Para mudanças no frontend, execute `npm run typecheck`, `npm test` e
  `npm run build`. Para mudanças em PHP/Laravel, execute `php artisan test`.
  Para o verificador matemático, execute
  `python -m unittest discover -s tests/math_verifier`.
- Para configurações e documentação, valide os formatos, os comandos e o
  comportamento afetados e execute `git diff --check` antes da entrega.
- Se algum teste necessário falhar ou não puder ser executado, resolva o
  problema e informe o impedimento ao usuário; não declare o trabalho
  validado. Depois de alterar o código, repita os testes afetados.
- Registre um relatório em `docs/relatorios/` com as alterações, os comandos
  executados, seus resultados, avisos e limitações. Não inclua credenciais.
- Ao entregar, forneça o relatório e indique o que está pronto ou pendente
  para que o usuário decida quando e o que commitar.

## Permissões do GitHub

A conta proprietária `FERNANDOIFTO2023` está isenta das proteções da `main`,
por solicitação do usuário. Isso não dispensa o agente de testar e relatar
antes da entrega. Colaboradores precisam de PR, aprovação do proprietário e CI
aprovado, conforme `CONTRIBUTING.md`.
