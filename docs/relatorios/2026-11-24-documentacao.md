# Revisão da documentação do projeto

Data: 24/11/2026. Alterações locais para revisão, sem staging, commit, push ou publicação.

## Escopo e identificação

A solicitação foi esclarecida: remover menções à autoria por assistentes, preservando a descrição técnica da geração automática, dos provedores e das demais funcionalidades. A revisão editorial não altera registros de execução, nomes de branches, comandos de ambiente ou créditos/licenças de terceiros necessários à rastreabilidade.

Identificação conferida com a especificação e o README existentes:

- Professor: **Marcos Raimundo**.
- Integrantes: **Fernando de Paula Matos**, **Vinicius Celestino**, **João Francisco** e **Gabriel Gutemberg**.
- IFTO, Campus Paraíso do Tocantins; Bacharelado em Sistemas de Informação; Linguagens e Técnicas de Programação III.

## Alterações

- Atualização da especificação acadêmica e do histórico até esta revisão: importação XLSX em Alunos e turmas, códigos automáticos, materiais privados, pesquisa externa opcional, painel por período, calendário, consumo de tokens, Sobre, navegação, filas de exportação e conferência matemática.
- Correção de afirmações antigas: publicação AWS/PostgreSQL já realizada, SymPy já integrado e exportações com armazenamento privado por versão. Mantidas as limitações de disponibilidade, conferência pedagógica e isolamento de recursos.
- Inclusão dos requisitos RF015–RF022 e RNF011–RNF012, distinguindo implementações de propostas futuras, como Google Drive e tema claro/escuro. Perfil permanece sem envio de foto.
- Remoção das referências a assistentes/ferramentas de elaboração nos textos metodológicos dos relatórios de comentários do código, materiais UI e documentação de movimento. Descrições funcionais de IA, caminhos técnicos usados nos comandos históricos e créditos dos recursos foram preservados.
- Atualização do README, guia técnico, mapa do código, segurança e documentação de PDF/arquivos. O guia distingue recriação do contêiner para aplicar `env_file` de simples reinício de processos.
- Novo índice em `docs/README.md` e gerador em `docs/tools/render-specification.py`, com fonte única no Markdown.
- Regeneração de `docs/ESPECIFICACAO-LTP3-PROVAAI.pdf` e `docs/Especificacao-Provaai.pdf`: ambos com dez páginas e conteúdo idêntico. A capa do PDF acadêmico anterior continha placeholders de professor/equipe; eles foram substituídos. Metadados de autoria contêm os quatro integrantes.

## Conferências executadas

| Verificação | Resultado |
| --- | --- |
| Leitura do código, rotas, configuração de workers e relatórios datados | Funcionalidades e limites confrontados com os arquivos existentes. |
| `python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/arial.ttf --font-bold C:/Windows/Fonts/arialbd.ttf` | Dois PDFs gerados, sem erro. |
| `python docs/tools/render-specification.py --help` e análise sintática por `ast.parse` | Interface do comando e sintaxe aprovadas. |
| Extração com `pypdf` | Dez páginas, sem páginas vazias, placeholders de nomes ou caracteres de substituição; nomes e metadados conferidos. |
| Comparação binária dos dois PDFs | Arquivos idênticos. |
| Conferência dos requisitos | 22 RF e 12 RNF no Markdown; códigos finais e novas funcionalidades presentes no PDF. |
| Verificação de links locais nos dez Markdown revisados/indexados | 116 destinos, nenhum inexistente. Links externos não foram consultados nesta revisão. |
| Renderização com `pdftoppm -scale-to 1100 -png` | Todas as páginas renderizadas e inspecionadas em painel; capa e página de materiais/indicadores conferidas em tamanho ampliado. |
| `git diff --check` | Aprovado; apenas avisos de normalização LF/CRLF do Git. |

Ambiente documental: Python e ReportLab do runtime local disponível, `pypdf`, Pillow, Poppler e fontes Arial regular/negrito existentes no Windows. O comando `python` da tabela representa esse executável. Nenhuma biblioteca foi acrescentada às dependências de execução do site.

Não foram reexecutadas suítes PHP, frontend ou matemática porque não houve alteração de aplicação, banco, prompts ou verificador. Os números de testes de 23/11 citados na especificação estão identificados como evidências anteriores; não representam novos testes desta entrega.

## Limites e entrega

Esta revisão não resolve a indisponibilidade do Gemini nem cadastra a chave Groq; a limitação operacional verificada anteriormente continua explicitada. Não houve acesso remoto, alteração de credenciais ou operação sobre dados de professores nesta tarefa.

Os relatórios de diagnóstico/publicação que já estavam sem rastreamento antes desta revisão foram preservados. A documentação está pronta para revisão e commit pelo usuário. Os dois PDFs devem acompanhar o Markdown; o gerador permite mantê-los sincronizados nas próximas revisões.

A limpeza dos arquivos intermediários foi rejeitada pela revisão automática de segurança (`blocked by policy`, sem justificativa detalhada). As renderizações e o verificador pontual permanecem em `tmp/pdfs/`, fora da entrega documental e sem credenciais; não precisam integrar o commit. A renderização final das dez páginas foi comparada byte a byte às imagens inspecionadas e permaneceu idêntica.

## Revisão posterior: estética acadêmica original

Por solicitação do usuário, a diagramação inicial descrita acima foi substituída pela estética de `ESPECIFICACAO-LTP3-PROVAAI.pdf` na versão de referência do Git. A entrega vigente tem **13 páginas**, mantendo o conteúdo atualizado. A contagem de dez páginas e o comando com Arial acima registram a primeira revisão, agora substituída visualmente.

- Recuperação do PDF anterior com `git show HEAD:docs/ESPECIFICACAO-LTP3-PROVAAI.pdf`, sem restaurar ou sobrescrever o Markdown atualizado.
- Inspeção visual e dos recursos do original: Times New Roman regular/negrito, corpo de 11 pt, títulos de 14/12 pt, células de 10 pt, entrelinhas, margens, grade de tabelas, cores e posições da capa.
- Logotipo institucional extraído sem edição do PDF anterior e salvo em `docs/assets/ifto-academico.png`. A capa mantém as posições anteriores e passa a mostrar os nomes corretos.
- Restabelecimento dos títulos pretos, cabeçalhos verde-claros, grade completa, cabeçalho com linha horizontal e paginação discreta. As seções principais começam em página própria, como na organização anterior.
- Comando vigente: `python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/times.ttf --font-bold C:/Windows/Fonts/timesbd.ttf`.
- Regeneração dos dois PDFs, conferência da identidade binária entre eles, de nomes/metadados, dos 22 RF e 12 RNF, das fontes incorporadas e do logotipo. Renderização das 13 páginas e inspeção visual da capa, das tabelas e do conjunto completo.
- `git diff --check` executado novamente. Nenhum conteúdo funcional, configuração da aplicação ou dado de produção foi alterado; sem staging ou commit.
