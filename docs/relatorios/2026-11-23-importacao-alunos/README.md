# Importação de alunos por Excel

Data: 23/11/2026. Alterações locais, sem staging, commit, push ou publicação.

## Funcionalidade entregue

Na aba **Alunos**, o cartão **Traga sua lista de alunos** oferece **Modelo Excel**
e **Importar alunos**. O professor escolhe uma turma ativa, anexa o arquivo,
confere a prévia e confirma o cadastro. A lista é atualizada imediatamente e
filtrada pela turma de destino.

O modelo publicado em `public/modelos/modelo-alunos.xlsx` contém:

- Aba **Alunos**, sem coluna de código: nome, nível atual, dificuldades/objetivos
  de aprendizagem e critérios específicos para as provas.
- Nome obrigatório, entre 2 e 100 caracteres. Nível em branco assume
  **Intermediário**, como no cadastro manual. A coluna oferece os três níveis
  atuais em uma lista de seleção. Os dois campos pedagógicos são opcionais,
  com limite de 2.000 caracteres cada.
- Cabeçalho congelado, campos editáveis destacados e aba **Instruções**.
  Não contém alunos de exemplo que possam ser cadastrados acidentalmente.

Limites: `.xlsx`, até 5 MB e até 500 alunos nas linhas 2 a 501. A aba deve
continuar chamada **Alunos**, com os quatro cabeçalhos originais. Outras abas
não são importadas. Não há suporte a `.xls`, CSV ou fórmulas nesta entrega.

## Validação e códigos

`POST /api/students/import` exige sessão, CSRF, turma pertencente ao professor
e turma ativa. A prévia não grava registros. A confirmação lê e valida novamente
o arquivo, incluindo mudanças ocorridas após a prévia.

A gravação acontece em uma única transação e adquire o mesmo bloqueio por
professor usado no cadastro manual. Os códigos seguem a maior sequência `A`
da turma, incluindo alunos arquivados: por exemplo, depois de `A009`, os próximos
são `A010` e `A011`. O cadastro manual continua a sequência após a importação.
Nenhum código enviado pelo arquivo é aceito.

Nomes repetidos no arquivo ou já existentes na turma impedem todo o lote, com
indicação da linha. A comparação ignora maiúsculas/minúsculas e espaços
repetidos. Isso impede duplicação em reenvios; **homônimos devem ser conferidos
e cadastrados manualmente**. Não há atualização nem mesclagem de cadastros
existentes durante a importação.

Trocar a turma ou o arquivo invalida a prévia. A confirmação fica indisponível
durante a requisição. Em caso de falha de comunicação, a mensagem orienta
conferir a lista antes de reenviar. Na demonstração, o modelo pode ser baixado,
mas a importação requer uma conta.

## Implementação

- Novo componente `components/student-import.tsx`, integrado ao diretório de
  alunos e ao estado da área do professor, com estilos responsivos.
- `StudentImportController` concentra autorização, conferência de duplicados
  e transação. `StudentSpreadsheet` faz leitura e validação da planilha.
- Nova dependência **OpenSpout**, versão travada em **4.33.0** no Composer,
  compatível com o PHP 8.3 usado pelo projeto. Não foi adicionada biblioteca
  de planilhas ao JavaScript entregue ao navegador.
- O ZIP é limitado a 1.000 entradas e 20 MB descompactados. Entradas com
  caminhos impróprios, macros e declarações DTD/ENTITY são recusadas.
  Fórmulas não são executadas; o arquivo enviado não é mantido pela aplicação.
- Comentários explicativos em português nos novos setores.
- Sem migração de banco. Na publicação normal, `composer install` instala a
  nova dependência e o build inclui a interface; o diretório público inclui
  o modelo. A configuração existente de proxy encaminha também `/modelos/`.

Referências consultadas: [OpenSpout](https://github.com/openspout/openspout),
[documentação da série 4](https://github.com/openspout/openspout/blob/4.x/docs/documentation.md).

## Testes executados

| Comando | Resultado |
| --- | --- |
| `php artisan test --filter=StudentImportTest` | 10 testes, 55 asserções, aprovados sem avisos |
| `php artisan test` | 66 testes, 454 asserções, aprovados |
| `npm run typecheck` | Aprovado |
| `npm test` | 54 testes aprovados |
| `npm run build` | Aprovado; aviso de bundle acima de 500 kB |
| `node --experimental-strip-types tests/browser/student-import.mjs` | Fluxo aprovado em 1440 e 375 pixels, após o build final |
| `composer validate --strict --no-check-publish` | JSON e lock válidos |
| `git diff --check` | Sem erros de whitespace |

Executáveis locais usados: PHP 8.3 em
`C:/Users/R3/.cache/provaai-tools/php83/php.exe`, Composer em
`C:/Users/R3/.cache/provaai-tools/composer.phar`, Node 24.22.1 e npm via
`C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`.
Para a suíte PHP completa, `PYTHON_BINARY` apontou para o ambiente
`C:/Users/R3/.cache/provaai-tools/math-docs-venv/Scripts/python.exe` e
`NODE_BINARY` para o Node disponível. Nenhum dado ou credencial de produção
foi utilizado.

Os testes de backend verificam prévia sem gravação, sequência após aluno
arquivado, continuação pelo cadastro manual, reenvio, nomes duplicados,
validação atômica, linhas vazias, permissões, turma arquivada entre prévia e
confirmação, arquivos inválidos, fórmulas, colunas extras, limites, ZIP excessivo,
DTD, 500 alunos e sequência além de `A999`. Também preenchem uma cópia do
**modelo publicado** e a importam pelo endpoint real, garantindo que as
instruções não virem alunos e que o arquivo seja compatível com o leitor.

Os testes de navegador usam Edge headless isolado e API simulada. Verificam
download do XLSX, bloqueio de formato inválido, erro por linha, prévia sem
confirmação, invalidação ao trocar turma/arquivo, bloqueio durante o envio e
exibição do aluno com o código retornado. Não houve erro JavaScript nem
transbordamento horizontal da página. A tabela da prévia tem rolagem própria.
Capturas conferidas: `previa-1440.png` e `previa-375.png`.

## Conferência do modelo e limitações

O modelo foi criado com Artifact Tool, inspecionado, recalculado e exportado.
A inspeção não encontrou erros de fórmula. A renderização PNG desse runtime
encerrou o processo sem diagnóstico neste Windows. Como alternativa de
conferência visual, o arquivo foi aberto e convertido para HTML pelo
LibreOffice, e as duas abas foram inspecionadas em capturas do navegador.
O HTML omite as linhas vazias formatadas; a leitura direta do XLSX e o teste
do modelo conferem sua estrutura. Não houve conferência manual no aplicativo
Microsoft Excel.

Os testes iniciais encontraram temporários bloqueados no Windows quando a
leitura era interrompida por erro. A liberação dos iteradores e dos ciclos do
leitor foi corrigida; a suíte final passou sem esses avisos. O teste de troca
de arquivo foi ajustado para efetivamente remover e anexar o arquivo, pois
selecionar o mesmo arquivo sem mudanças não dispara `change` no navegador.

O build continua emitindo aviso de bundle maior que 500 kB, sem falha de
compilação. Git também avisa da conversão habitual de LF para CRLF em alguns
arquivos. A suíte de banco usa SQLite isolado; não foi executado teste de
concorrência entre processos em PostgreSQL/MySQL nem build Docker neste host.

**Pronto para revisão e commit pelo usuário.** A publicação e a conferência
com uma conta no ambiente publicado permanecem fora desta execução.
