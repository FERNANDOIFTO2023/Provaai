# Importação pelos cartões e páginas das turmas

Data: 23/11/2026. Continuação da importação Excel. Sem staging, commit, push ou publicação.

## Verificação do acesso em Alunos

O código local já contém o cartão com **Modelo Excel** e **Importar alunos**
na aba **Alunos**. A versão inicial desta execução estava limpa, no commit
`ef6db93` (`Importação`).

Uma consulta HTTP pública a `https://provaai.vercel.app` retornou o bundle
`/build/assets/app-DMEFEJkv.js`. Esse arquivo não contém o endpoint
`/api/students/import` nem a referência `modelo-alunos.xlsx`.
O endereço público `/modelos/modelo-alunos.xlsx` retornou **404**.
Portanto, a versão publicada consultada ainda não disponibiliza a funcionalidade
presente no repositório local. Não é necessário criar outra aba no menu.

A configuração `deploy/check-origin.mjs` encaminha a aplicação para
`PROVAAI_ORIGIN`. A publicação precisa atualizar a origem Laravel com o frontend
compilado, a dependência Composer e o arquivo público do modelo. Recarregar
o navegador não acrescenta os arquivos que ainda faltam nessa origem.
Não foram consultados logs privados de deploy para determinar por que essa
origem ainda serve a versão anterior.

## Alterações

- Cada cartão de turma tem um botão **Importar alunos**, independente do botão
  que abre a turma e do botão de edição.
- A página interna da turma também oferece **Importar alunos**, junto às ações
  de cadastro e edição.
- Os dois acessos abrem o mesmo formulário de importação, já expandido, com
  **Modelo Excel** disponível e a turma de destino fixada.
- A prévia e a confirmação enviam o identificador da turma de origem. O usuário
  não precisa procurar novamente a turma na lista.
- Após importar, o estado compartilhado atualiza o contador no cartão, os alunos
  da turma e o diretório geral. Busca e filtro de retirados da turma são limpos
  para não esconder o cadastro novo.
- Turmas inativas mostram o acesso desabilitado e precisam ser reativadas.
- Fechar o diálogo restaura a página de origem pelo mecanismo de histórico
  existente. Voltar/Avançar não restaura a importação concluída.
- O acesso geral em **Alunos** continua permitindo escolher a turma.

Não houve alteração no backend, no modelo Excel nem na regra de códigos.

## Testes executados sobre a alteração final

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm test` | 54 testes aprovados |
| `npm run build` | Aprovado, com aviso de chunk acima de 500 kB |
| `node --experimental-strip-types tests/browser/student-import.mjs` | Aprovado em 1440 e 375 pixels |
| `node tests/browser/workspace-navigation.mjs` | 17 cenários aprovados, nenhuma falha |
| `git diff --check` | Sem erros de whitespace |

Execução local: npm via
`node C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`.
Playwright via `PLAYWRIGHT_MODULE` apontando para o runtime instalado e
`CHROME_PATH` apontando para o Microsoft Edge. Navegador isolado, dados
fictícios e respostas de API simuladas; nenhuma conta real foi alterada.

O teste ampliado confirma o acesso em **Alunos**, importa para uma segunda
turma pelo cartão e para a primeira pela página interna. Confere o identificador
enviado em cada requisição, a seleção bloqueada, a limpeza do arquivo anterior,
a atualização do contador e da tabela de alunos, o bloqueio de turmas inativas
e o comportamento de Voltar/Avançar. A suíte anterior de validação de arquivo
e prévia permanece no mesmo teste.

Capturas inspecionadas: `cartoes-1440.png`, `cartoes-375.png`,
`cartao-turma-1440.png` e `cartao-turma-375.png`. O formulário mantém rolagem
vertical no diálogo e horizontal somente na tabela de prévia quando necessário.

## Estado da entrega

Pronto localmente para revisão e commit pelo usuário. Ainda é necessária a
publicação da versão atual na origem do site para os novos acessos aparecerem
online. Não foi feita publicação nem teste autenticado em produção nesta execução.
