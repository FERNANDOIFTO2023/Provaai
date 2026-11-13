# Testes de navegação

`npm run test:navigation` compila o frontend e abre um navegador isolado,
sem usar a sessão pessoal do navegador. O servidor temporário serve o build
real do aplicativo em uma porta local disponível e é encerrado ao final.

Os testes usam a demonstração com dados fictícios. Apenas `/api/auth/session`
e `/api/config` recebem respostas simuladas; qualquer outra chamada à API
faz o cenário falhar. Não é necessário iniciar Laravel nem configurar banco,
conta ou IA. Erros JavaScript não tratados também fazem o cenário falhar.

## Requisitos e execução

Além das dependências normais do projeto, disponibilize o pacote Playwright
(validado com 1.62.1) e um navegador Chromium. Se Playwright não estiver
instalado no projeto, `PLAYWRIGHT_MODULE` pode apontar para seu `index.mjs`
com uma URL `file:///...`, como nos testes existentes de prévia de e-mail.
`CHROME_PATH` pode apontar para Chrome ou Edge instalado; sem essa variável,
Playwright usa seu Chromium padrão.

Exemplo PowerShell, ajustando os caminhos da instalação:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///C:/ferramentas/node_modules/playwright/index.mjs'
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:navigation
```

Para repetir um cenário específico, defina `NAVIGATION_TEST_FILTER` com um
trecho de seu nome. Remova a variável para executar a suíte completa.

## Comportamento esperado

- Voltar e Avançar percorrem páginas e a turma selecionada, sem reabrir
  cadastros, revisões ou janelas de progresso já encerradas.
- Cancelar, Fechar e Escape retornam à página onde o formulário foi aberto.
- Salvar uma turma leva aos detalhes; Voltar retorna à lista sem reabrir a edição.
- O histórico não armazena rascunhos de formulários. Ao usar Voltar com um
  formulário aberto, o navegador retorna à página anterior e fecha o formulário.
- Recarregar não restaura um formulário aberto, inclusive em entradas de
  histórico criadas pela versão anterior.
- O menu móvel, os filtros por turma na biblioteca e os campos de histórico
  pertencentes a outros componentes continuam funcionando.
