# Modelos e provas individuais — revisão visual

Data: 13/11/2026. Base: `30ddf29` — Navehação melhorada.

## O que mudou

**Modelos de prova:** biblioteca com busca por nome/arquivo, filtros Todos,
PDF e Word, identificação do padrão atual e contagem dos resultados. Os
cartões distinguem os formatos e reúnem as ações secundárias em “Revisão e
opções”, mantendo releitura, recorte do PDF, revisão do texto e abertura do
original. As ilustrações dos documentos são decorativas; não são miniaturas
do conteúdo dos arquivos. Há indicação textual de leitura pendente ou falha.

**Provas individuais:** resumo de alunos acompanhados, provas em revisão e
aprovadas; botão Adicionar aluno leva à busca; cartões usam iniciais e a cor
da turma, com foco pedagógico separado do histórico. As avaliações aparecem
em linhas mais compactas, e o histórico pode ser recolhido. A estrutura se
adapta ao celular, inclusive com nomes longos e ações em linhas separadas.

**Interações:** transições discretas nos cartões e filtros, realce ao passar
o mouse, feedback imediato nas buscas e respeito ao movimento reduzido.
Nenhuma dependência de produção foi adicionada.

## Verificação

| Verificação | Resultado |
| --- | --- |
| TypeScript: `node node_modules/typescript/bin/tsc --noEmit` | Aprovado |
| Testes existentes: `node --disable-warning=ExperimentalWarning --experimental-strip-types --test tests/*.test.mjs tests/*.test.ts` | 52 aprovados, zero falhas |
| Navegação: `node tests/browser/workspace-navigation.mjs` | 17 cenários aprovados, zero falhas |
| Telas e interações: `node --experimental-strip-types tests/browser/collections-visual.mjs` | Aprovado em 1440 × 1000 e 375 × 1000 |
| Build Vite | Compilado pelo mesmo build de produção antes das suítes de navegador |
| `git diff --check` | Aprovado |
| Evidência de design: checker da skill `frontend-design-direction` sobre `evidence.json` | Conferência do registro e das capturas |

O comando novo `npm run test:collections` executa a suíte dessas telas. Os
requisitos e as variáveis `PLAYWRIGHT_MODULE` e `CHROME_PATH` estão em
`tests/browser/README.md`. Neste ambiente foram usados Playwright 1.62.1 e
Microsoft Edge/Chromium, em perfil isolado. Os scripts npm foram executados
diretamente com Node porque npm não está no PATH.

### Cenários exercitados nas telas

- Busca, filtros por formato e limpeza de uma seleção sem resultados.
- Modelo padrão atualizado, modelo pendente bloqueado e falha de processamento.
- Permissão negada preserva a seleção; tentativa autorizada posterior funciona.
- Opções por teclado, foco visível e acesso ao ajuste de cabeçalho PDF.
- Edição e salvamento do texto extraído de um arquivo Word.
- Contadores de avaliações e atualização após adicionar um aluno.
- Busca sem alunos, histórico recolhido/expandido, revisão e preparação de prova.
- Nomes longos, movimento reduzido e hover quando movimento está habilitado.
- Ausência de overflow horizontal; controles principais com altura mínima de
  44px e coluna de título de prova com pelo menos 180px.

Durante a inspeção visual, a grade de avaliações no celular comprimia o texto
em uma coluna estreita. A grade foi corrigida, uma asserção de largura mínima
foi adicionada, e os cenários e capturas afetados foram refeitos com sucesso.

Seis pares de cores de texto usados nestas telas foram conferidos, entre
5,77:1 e 9,04:1 de contraste. Isso não substitui uma auditoria completa de
acessibilidade com tecnologias assistivas.

## Capturas com dados fictícios

- [Modelos — computador](modelos-1440.png)
- [Modelos — celular](modelos-375.png)
- [Provas individuais — computador](individuais-1440.png)
- [Provas individuais — celular](individuais-375.png)
- [Opções do PDF — celular](modelos-opcoes-375.png)
- [Busca de modelos vazia — celular](modelos-vazio-375.png)
- [Busca de alunos vazia — celular](individuais-vazio-375.png)

## Limites e entrega

A suíte das coleções usa o aplicativo real com uma conta e APIs simuladas
inteiramente locais. Não houve acesso a dados reais. Não foram exercitados
o upload/conversão real, o provedor de IA ou a autorização no backend. As
ações de revisão e os estados de resposta foram testados na interface. PHP
não foi alterado nem sua suíte executada. Firefox/WebKit não foram testados.

Os testes existentes de PDF mantêm avisos de fontes/indexação sem falhas.
O limite de tamanho do bundle continua sendo um aviso do projeto. A suíte
visual não foi adicionada ao CI e depende de Playwright disponível no ambiente.

As alterações estão locais, sem staging, commit, push ou publicação.
