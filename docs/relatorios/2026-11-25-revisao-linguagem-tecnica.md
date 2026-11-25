# Revisão da linguagem técnica

## Alterações

Adotamos a primeira pessoa do plural nos trechos narrativos da apresentação, do resumo técnico, da especificação acadêmica, do README e do guia técnico. Utilizamos construções como “desenvolvemos”, “migramos”, “centralizamos” e “validamos”, preservando os conceitos, resultados e limites registrados.

Revisamos também textos de manutenção e relatórios para retirar atribuições narrativas desnecessárias. Mantivemos definições do glossário, requisitos, descrições de funcionalidades e evidências históricas em linguagem objetiva. Preservamos as regras de contribuição, os comandos, os nomes reais de branches e os créditos e licenças de terceiros.

Atualizamos os quatro PDFs: apresentação com glossário (12 páginas), resumo técnico (2 páginas) e as duas cópias da especificação acadêmica (16 páginas cada). Mantivemos a capa acadêmica e a tipografia Times New Roman.

## Validação documental

- Executamos o gerador da apresentação, `apresentacao-acessivel.py`, e o gerador do resumo, `resumo-apresentacao.py`, no diretório local de ferramentas, com o Python do runtime de documentos: concluídos sem erro na versão final.
- Executamos `python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/times.ttf --font-bold C:/Windows/Fonts/timesbd.ttf`: dois PDFs acadêmicos sincronizados.
- Conferimos a extração de texto e os metadados dos quatro PDFs com pypdf. A busca editorial não encontrou atribuições narrativas indevidas nem caracteres de substituição.
- Renderizamos os documentos com pypdfium2 e inspecionamos suas páginas. Não identificamos cortes, sobreposições ou perda de conteúdo nas alterações.
- Comparamos a capa acadêmica antes e depois por pixels: resultado idêntico. As duas cópias acadêmicas também são idênticas byte a byte.
- Executamos `git diff --check`: aprovado; avisos do Git referem-se somente à normalização futura de finais de linha LF/CRLF.

## Entrega

Documentos prontos para revisão e apresentação. Esta revisão não altera o código da aplicação, os dados, as permissões de contribuição ou a infraestrutura; não executamos novamente as suítes funcionais. Não realizamos staging, commit ou push.
