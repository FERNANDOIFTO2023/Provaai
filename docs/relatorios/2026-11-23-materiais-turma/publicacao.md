# Verificação do painel ausente no site

Data: 23/11/2026.

## Diagnóstico confirmado

O commit `926ea46a0248162b547125a224cd0a4a8542f06f` já estava na `main` do GitHub. A Vercel também registrava esse commit como `READY`, mas funciona como entrada para o backend na AWS. O sucesso da Vercel, isoladamente, não confirma que a aplicação na AWS foi atualizada.

Na primeira tentativa do [workflow 45225110223](https://github.com/FERNANDOIFTO2023/Provaai/actions/runs/45225110223), o job `validate` passou, mas o job `migration` falhou ao construir a imagem Docker. O Composer recebeu HTTP 504 do GitHub ao baixar `brick/math` e `laravel/tinker`. A execução parou antes de aplicar as migrações. Não foi identificada falha de código ou de migração nessa tentativa.

O script `deploy/release.sh` exige conclusão `success` do workflow antes de atualizar a aplicação. Assim, a falha de download bloqueou a publicação. A conferência HTTP do site retornou o bundle antigo `app-83Ushon7.js`, sem o texto `Materiais da turma` e sem a rota de materiais. O painel estava ausente na versão entregue pelo servidor.

## Ação executada

Foi solicitada a repetição apenas dos jobs com falha, pela API `rerun-failed-jobs`. O GitHub aceitou a solicitação com HTTP 201, iniciando a tentativa 2 sobre o mesmo commit. Não foram alterados código, dependências, proteções ou branches, nem criados commits. A atualização continua condicionada à aprovação das verificações existentes.

## Verificações

- `git ls-remote origin refs/heads/main`: confirmou o commit publicado pelo usuário.
- API do GitHub Actions: conferência de conclusão, jobs e logs autenticados, sem expor credenciais.
- Conector Vercel: conferência do commit e do estado do deployment de produção.
- HTTP do site e de seu JavaScript: conferência da versão efetivamente servida.
- `git diff --check`: validação da documentação.

Não houve mudança de implementação nesta investigação; por isso não foi necessário repetir as suítes locais já aprovadas. A tentativa remota repete a construção da imagem e suas verificações de migração/conversão.

## Localização da funcionalidade

**Minhas turmas → abrir a turma → Conteúdo para as provas → Materiais da turma → Anexar material de estudo**. O painel fica depois do resumo de alunos/provas e antes da lista de alunos. Depois da atualização, uma aba que já estava aberta precisa ser recarregada para carregar o JavaScript novo.

## Resultado da tentativa e da publicação

A tentativa 2 terminou com **success** nos jobs `validate` e `migration`, às 14h27min58s (Brasília). A construção da imagem, a migração em PostgreSQL isolado e as verificações de conversão passaram. O erro 504 não se repetiu.

A origem atualizou e o site passou a entregar `app-JxOxgHCI.js`, contendo o painel de materiais. Em seguida, um Edge isolado abriu **o site público**, entrou na demonstração, abriu a turma `7º ano A` e expandiu **Materiais da turma**. O painel apareceu na posição prevista, sem exceções JavaScript. [Captura da página publicada](painel-publicado.png).

A rota `/api/classes/{classId}/materials`, consultada sem sessão e com UUID fictício, respondeu HTTP 401, preservando a autenticação. Não foi enviado arquivo nem criada prova/dado de professor em produção; o teste visual usou apenas a demonstração. O upload autenticado havia sido coberto pelos testes da implementação, não foi repetido na conta real do usuário.

Resultado: **painel confirmado no site publicado**. A recuperação ocorreu repetindo a etapa temporariamente indisponível, sem novo commit. Este relatório e a captura são os únicos arquivos locais novos desta investigação.
