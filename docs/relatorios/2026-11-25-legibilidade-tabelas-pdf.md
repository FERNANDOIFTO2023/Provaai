# Legibilidade das tabelas dos PDFs — 25/11/2026

## Alterações

Revisamos os quatro PDFs da documentação para melhorar a leitura dos quadros. Os arquivos já continham texto vetorial; identificamos fontes pequenas nas tabelas como um fator que prejudicava a leitura com a página reduzida na tela. Não identificamos rasterização do texto das tabelas.

- Na especificação acadêmica, aumentamos as células de 10 para 11 pontos, com entrelinha de 15 pontos, e utilizamos Arial incorporada no PDF. Mantivemos Times New Roman no corpo e preservamos a capa institucional.
- Nas apresentações, aumentamos as células de 9,7 para 11 pontos e as rotas de 9 para 10,5 pontos. Aplicamos texto preto, fundo branco e cabeçalhos claros com negrito.
- Ajustamos larguras de colunas para manter os títulos “Versão” e “Responsabilidade” inteiros.
- Acrescentamos ao gerador acadêmico as opções `--table-font-regular` e `--table-font-bold`, que devem ser fornecidas juntas. Sem essas opções, o gerador continua utilizando as fontes do corpo nas tabelas.

O documento acadêmico passou de 16 para 17 páginas para acomodar a tipografia maior. A apresentação completa continua com 12 páginas, incluindo o glossário, e o resumo continua com duas páginas. As duas cópias da especificação acadêmica permanecem idênticas.

## Comandos e resultados

Utilizamos o Python disponível em `C:/Users/R3/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`, com ReportLab, pypdf, pypdfium2 e Pillow.

```powershell
python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/times.ttf --font-bold C:/Windows/Fonts/timesbd.ttf --table-font-regular C:/Windows/Fonts/arial.ttf --table-font-bold C:/Windows/Fonts/arialbd.ttf
python C:/Users/R3/.cache/provaai-tools/resumo-apresentacao.py
python C:/Users/R3/.cache/provaai-tools/apresentacao-acessivel.py
python C:/Users/R3/.cache/provaai-tools/verificar-nitidez.py
python docs/tools/render-specification.py --help
git diff --check
```

Os três comandos de geração concluíram com sucesso. Os scripts de apresentação já utilizados nas entregas anteriores permanecem no cache local; `apresentacao-acessivel.py` utiliza também `apresentacao-arquitetura.py`. O gerador acadêmico está versionado em `docs/tools/`.

Conferimos os seguintes resultados:

- Extração do texto dos quatro PDFs e comparação das contagens de palavras alfabéticas com os arquivos anteriores: nenhuma palavra ausente. Cabeçalhos repetidos em novas páginas podem acrescentar ocorrências.
- Fontes TrueType utilizadas no conteúdo incorporadas aos PDFs.
- Comparação da capa acadêmica renderizada antes e depois: pixels idênticos na mesma escala.
- Comparação binária entre os dois PDFs acadêmicos: arquivos idênticos.
- Renderização e inspeção visual das 31 páginas distintas: 17 da especificação, 12 da apresentação e duas do resumo. Não observamos cortes ou sobreposição nas tabelas.
- Análise sintática com `ast.parse` dos quatro geradores: aprovada.
- Ajuda do gerador acadêmico: execução bem-sucedida, com as novas opções descritas.
- Argumento de fonte de tabela sem sua variante em negrito: rejeição com código 2 e mensagem explicativa, conforme esperado.
- `git diff --check`: sem erros de whitespace.

## Escopo e limitações

As alterações afetam documentos e o gerador da especificação. Não alteramos frontend, backend, banco ou infraestrutura; por isso, não executamos as suítes funcionais da aplicação nesta entrega. A suavização de letras ainda depende do leitor de PDF, da escala de visualização e da tela; a revisão melhora tamanho e contraste sem converter texto em imagem.

Mantivemos as alterações locais, disponíveis para revisão e commit pelo responsável. Não executamos staging, commit ou publicação.
