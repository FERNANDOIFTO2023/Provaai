# Melhoria de leitura do painel de materiais

Data: 23/11/2026. Alterações locais para revisão e commit pelo usuário. Sem staging, commit, push ou publicação.

## Resultado

O painel agora prioriza o envio do material e a escolha de pesquisa externa. No computador, essas ações aparecem lado a lado; em espaços menores, são empilhadas conforme a largura disponível no painel. Os avisos necessários continuam acessíveis, sem ocupar a primeira área de leitura.

| Aspecto | Antes | Depois |
| --- | --- | --- |
| Hierarquia | Parágrafos seguidos antes do envio | Seções “Materiais de estudo” e “Pesquisa externa”, com títulos e espaçamento |
| Envio | Controle de arquivo com aparência padrão do navegador | Botão “Selecionar arquivo”, formatos e limite próximos da ação |
| Pesquisa | Checkbox no meio dos textos | Seção própria com estado escrito, explicação e alerta quando ativada |
| Legibilidade | Texto de 13 px em linhas extensas | Corpo de 14 px, entrelinha de 1,65 e largura de leitura dividida |
| Informações complementares | Todas expostas ao mesmo tempo | Limites e regras em seção expansível; aviso PowerPoint permanece visível |
| Arquivos | Lista pouco diferenciada | Nome, ícone, contador, ações e prévia em área própria |
| Teclado e toque | Seletor nativo e pouco destaque | Botão acessível pelo teclado, foco visível e alvo de pelo menos 44 px |
| Tablet | Botões do topo da turma ultrapassavam a página em 768 px | Botões quebram linha dentro da largura disponível |

Os ajustes priorizaram espaçamento, hierarquia, bordas, foco e áreas de clique. As regras de upload, privacidade, geração, limites e gravação da preferência foram preservadas. A interface continua informando que os anexos são opcionais, que cada geração cria novas questões e que alterações nas fontes só valem para novas provas.

## Arquivos alterados

- `components/class-materials.tsx`: organização, textos, botão de seleção, mensagens e ajuda expansível. IDs locais com `useId` associam controles às descrições.
- `resources/css/collections.css`: estilo do painel, contraste, foco e adaptação à largura do contêiner.
- `components/teacher-workspace.tsx`: classe específica para corrigir a quebra dos botões do topo da turma em tablets.
- `tests/browser/class-materials.mjs`: amplia os cenários para 1440, 768, 375 e 320 px; confere teclado, ajuda, alvo de toque e contador.

## Validação

- `npm run typecheck`: aprovado.
- `npm test`: 61 testes aprovados.
- `npm run build`: aprovado. Permanece o aviso de chunk principal acima de 500 kB.
- `node --experimental-strip-types tests/browser/class-materials.mjs`: aprovado em **1440, 768, 375 e 320 px**. Conferidos seletor pelo teclado, foco visível, ajuda expansível, upload, bloqueio durante envio, contador, texto extraído, download, preferência após recarga, erro de upload, remoção, turma arquivada e ausência de rolagem horizontal.
- `node tests/browser/workspace-navigation.mjs`: 17 cenários aprovados, nenhuma falha.
- Inspeção visual das capturas em desktop, tablet e celular.
- `git diff --check`: aprovado.

Os testes de interface usam o build real e um Edge isolado com respostas HTTP simuladas. Não acessam a conta do professor nem modificam dados de produção. Esta alteração é de frontend; não houve modificação de PHP, migração ou verificador matemático. Não se declara uma auditoria completa de acessibilidade: foram verificadas as interações e condições descritas acima.

Ambiente: npm pelo executável local `C:/Users/R3/.cache/codex-tools/npm/package/bin/npm-cli.js`, Node 24.22.3, Playwright do runtime local e Microsoft Edge via `CHROME_PATH`. Nenhuma variável da aplicação ou credencial foi alterada.

## Capturas para revisão

- [Computador, sem anexos](vazio-1440.png)
- [Celular, sem anexos](vazio-375.png)
- [Tablet, com arquivo e pesquisa externa](materiais-768.png)
- [Computador, com referência restrita](restrito-1440.png)

## Publicação

O novo visual está validado localmente. Para aparecer no site, depende do commit/push do usuário e da publicação automática aprovada. Esta mudança visual não precisa de nova migração de banco.
