# Atualização da especificação acadêmica

Data: 25/11/2026

## Conteúdo revisado

Atualizados `ESPECIFICACAO-LTP3-PROVAAI.md`, `ESPECIFICACAO-LTP3-PROVAAI.pdf` e a cópia compatível `Especificacao-Provaai.pdf`.

O histórico registra as mudanças de 24 e 25/11: confirmação separada da aprovação, tela compacta de downloads, indicação das etapas de salvamento, limite de espera de 60 segundos por requisição e retirada do título interno na exportação da prova do aluno. Os requisitos RF013 e RNF008, o mapa de telas e a nova seção 3.7 descrevem essas regras e seus limites. Permanecem 22 requisitos funcionais e 12 não funcionais.

A seção de validação incorpora os resultados já executados: 68 testes de frontend, 103 testes PHP com 755 verificações, 20 cenários de navegador na entrega da tela de downloads e dois testes reexecutados do conversor. Não houve nova execução dessas suítes nesta revisão exclusivamente documental. A confirmação do responsável sobre o funcionamento da aprovação foi registrada separadamente dos testes locais e da disponibilidade dos provedores.

## Geração e conferência

Comando usado com o Python do ambiente de documentação:

```powershell
python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/times.ttf --font-bold C:/Windows/Fonts/timesbd.ttf
```

Os PDFs têm 16 páginas e conteúdo binário idêntico entre si. Todas as páginas foram renderizadas com Poppler e inspecionadas em uma folha de contato. Não foram observados cortes ou sobreposições. A capa foi renderizada antes e depois, na mesma resolução; a comparação de pixels não encontrou diferenças. Mantidos logotipo institucional, disciplina, professor, equipe e posições da capa.

A validação por extração de texto confirmou as novas regras, datas, nomes, metadados e quantidades de requisitos. Foram conferidos nove links locais na especificação e os limites das coordenadas de texto em todas as páginas. `git diff --check` passou. Os arquivos temporários desta conferência foram removidos após a validação.

Sem alterações no código funcional, no banco ou na produção. Sem staging, commit, push ou deploy.
