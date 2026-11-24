# Documentação do Provaai

Revisada em 24/11/2026. Projeto do Bacharelado em Sistemas de Informação do IFTO, Campus Paraíso do Tocantins, na disciplina Linguagens e Técnicas de Programação III.

**Professor:** Marcos Raimundo.

**Integrantes:** Fernando de Paula Matos, Vinicius Celestino, João Francisco e Gabriel Gutemberg.

## Documentos atuais

| Documento | Finalidade |
| --- | --- |
| [Especificação editável](ESPECIFICACAO-LTP3-PROVAAI.md) | Identificação acadêmica, histórico, requisitos, funcionalidades, arquitetura e limites. |
| [Especificação em PDF](ESPECIFICACAO-LTP3-PROVAAI.pdf) | Versão para leitura, impressão e entrega. |
| [PDF com nome anterior](Especificacao-Provaai.pdf) | Cópia idêntica, mantida para compatibilidade com links existentes. |
| [Guia técnico](GUIA-TECNICO.md) | Instalação, variáveis, processos e publicação. |
| [Mapa do código](MAPA-DO-CODIGO.md) | Localização dos módulos e regras de manutenção. |
| [PDF e arquivos](PDF-E-ARQUIVOS.md) | Modelos, materiais, preparação dos downloads e formatos. |
| [Verificação matemática](VERIFICACAO-MATEMATICA.md) | Instalação, cobertura e limites da conferência local. |
| [Segurança](SEGURANCA.md) | Autorização, isolamento e limites conhecidos. |
| [Migração e publicação](MIGRACAO-LARAVEL.md) | Procedimentos e registros históricos da transição para Laravel/AWS. |

Os relatórios em `relatorios/` são evidências datadas. Seus resultados se referem à versão e ao ambiente de cada execução, não a uma garantia de disponibilidade atual. Recursos planejados, como Google Drive e tema claro/escuro, estão separados das funcionalidades implementadas.

## Atualizar os PDFs

Edite primeiro `ESPECIFICACAO-LTP3-PROVAAI.md`. Na raiz do repositório, execute o gerador com Python e ReportLab instalados em um ambiente de documentação:

```powershell
python docs/tools/render-specification.py --font-regular C:/Windows/Fonts/times.ttf --font-bold C:/Windows/Fonts/timesbd.ttf
```

O padrão acadêmico preserva a estética do PDF anterior: Times New Roman, capa institucional com logotipo do IFTO, títulos pretos, tabelas com grade e cabeçalho verde-claro. O logotipo em `assets/ifto-academico.png` foi recuperado do PDF versionado, sem alteração.

Em outro sistema, informe arquivos TrueType regular e negrito da Times New Roman para manter a aparência. O gerador lê a equipe, o professor e a data do Markdown e escreve os dois PDFs com o mesmo conteúdo. Não instala fontes nem altera a aplicação. Confira o texto extraído, os metadados e as páginas renderizadas antes da entrega.
