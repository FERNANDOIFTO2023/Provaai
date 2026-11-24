# PDF, modelos e arquivos

PDFs de até 20 MiB podem ser anexados como modelo. O professor seleciona de 5% a 45% do topo da primeira página. Esse cabeçalho preserva a aparência como imagem e aparece somente na primeira página da prova exportada; as questões do PDF não são extraídas nem enviadas à IA. O corpo novo é diagramado pelo Provaai: não se reproduzem exatamente todas as páginas do original.

PDFs escaneados podem fornecer cabeçalhos visuais. Arquivos protegidos, danificados ou incompatíveis são recusados. A prévia e o cache privado evitam renderizações repetidas.

Na primeira leitura, se o recorte inicial de 25% atravessar uma borda ou linha, o site procura uma faixa em branco nos próximos quatro pontos percentuais da página. O ajuste manual em **Modelos → Ajustar cabeçalho do PDF** usa a altura exata indicada pelo professor.

DOCX serve de modelo de diagramação e referência textual. O conversor abre modelos DOC antigos no LibreOffice e os transforma em DOCX antes de preencher os campos e inserir as questões. O cabeçalho do Word é usado apenas na primeira página, priorizando o cabeçalho próprio de primeira página quando existir. Rodapés e margens acompanham a exportação. A posição dos campos depende da estrutura do Word original. O texto extraído deve conter de 20 a 60.000 caracteres.

Provas aprovadas podem ser exportadas em PDF e DOCX, com ou sem gabarito. Editar conteúdo, matéria, tópicos ou título devolve a prova ao rascunho. O servidor confere aprovação e propriedade antes de exportar.

Laravel gerencia upload, autorização e download. Arquivos ficam em `storage/app/private/{bucket}/{user_id}/...`, fora de `public/`. Não crie link público dessa pasta. O navegador recebe uma rota que exige sessão, não um link público permanente.

A conversão usa processos Node iniciados por PHP, com limite de 120 segundos por operação de documento. Uma exportação pode encadear leitura de cabeçalho, montagem e conversão; esse limite não é promessa de duração total. O conteúdo estruturado fica no banco e pode ser exportado novamente. Testes executaram Word, cabeçalho PDF e exportações PDF/DOCX reais; não cobrem todos os documentos possíveis. Os limites de isolamento estão em [Segurança](SEGURANCA.md).

O servidor monta o DOCX por versão da prova, configuração de modelo e tipo de arquivo do aluno ou gabarito. O PDF usa esse mesmo Word. Após aprovação, o worker `documents` prepara os arquivos; artefatos válidos ficam no armazenamento privado e podem atender downloads seguintes sem repetir a conversão. A chave considera o conteúdo e as configurações relevantes; alterações não podem entregar uma versão antiga. O cache de cabeçalho continua com cinco minutos. O indicador acompanha preparação, transferência e montagem do ZIP e chega a 100% quando o site entrega o arquivo ao navegador.

A fila de documentos usa timeout de 420 segundos e reserva de 480 segundos; há um worker de preparação por contêiner. O conversor usa `noInitialRun: true` para evitar o conflito entre a entrada automática do runtime e a inicialização pela biblioteca LibreOfficeKit, associado ao travamento observado. Esses controles não garantem download imediato: arquivos ainda não preparados podem exigir conversão. Reaproveitar o arquivo da mesma prova não copia questões de outra avaliação. Evidências em [preparação de downloads](relatorios/2026-11-16-downloads/IMPLEMENTACAO.md) e [correção do conversor](relatorios/2026-11-16-downloads/CORRECAO-CONVERSOR.md).

## Fórmulas e espaço para respostas

O Gemini recebe orientações para escrever matemática em LaTeX delimitado por `\(...\)` (no texto) ou `\[...\]` (em destaque). A leitura também aceita `$$...$$`; cifrões simples permanecem texto, preservando preços. Questões antigas com `1/2` ou símbolos Unicode continuam como foram escritas, sem conversão automática que possa alterar seu sentido.

KaTeX carrega sob demanda e mostra prévias de instruções, enunciados, alternativas e respostas durante a revisão. O campo de edição mantém a notação original. Fórmulas incompletas exibem um aviso, sem interromper a edição. HTML, recursos externos e macros personalizadas não são aceitos. As expansões, o tamanho e o comprimento das expressões têm limites.

Na exportação, `mathml2omml` converte o MathML do KaTeX em equações nativas editáveis do Word. O PDF de produção usa o mesmo DOCX pelo conversor existente. Há tratamento para argumentos de integrais, delimitadores extensíveis de matrizes e conjuntos numéricos. Expressões inválidas ou estruturas sem suporte bloqueiam o download com orientação para revisão; não são impressas silenciosamente como LaTeX. O cache de exportação foi atualizado para não reaproveitar documentos do formato anterior.

Nas questões discursivas de Matemática e disciplinas matemáticas reconhecidas (como Cálculo, Álgebra, Geometria e Estatística), o documento reserva espaço em branco para cálculos. Nas demais matérias, cinco linhas ocupam a largura útil entre as margens. A escolha usa a matéria informada, e não a presença de símbolos no enunciado. Questões objetivas e gabaritos não recebem essas linhas.

A demonstração local gera DOCX com equações. Seu exportador PDF simplificado não possui composição matemática e orienta o uso do DOCX quando encontra fórmulas. Na conta autenticada, PDF e DOCX passam pelo servidor e suportam as equações testadas.

Essa implementação trata apresentação. Separadamente, o SymPy está integrado à conferência de cálculos explícitos e equações de primeiro/segundo grau nos formatos delimitados pelo [verificador matemático](VERIFICACAO-MATEMATICA.md). Casos não suportados exigem revisão e não recebem certificação. A revisão do professor permanece necessária. A validação de apresentação cobre frações, potências, índices, raízes, integrais, somatórios, limites, matrizes, vetores e conjuntos; isso não significa que todos esses conteúdos sejam conferidos matematicamente nem que todos os comandos LaTeX e modelos Word sejam suportados.

## Materiais de estudo da turma

Os materiais de estudo são separados dos modelos de diagramação. Em **Minhas turmas → abrir turma → Conteúdo para as provas → Materiais da turma**, anexe PDF, DOC, DOCX, PPT ou PPTX. São até cinco arquivos, 20 MB por arquivo e 60.000 caracteres agregados; a leitura ocorre no envio. Não há OCR para documentos digitalizados. Animações avançadas, vídeos e conteúdo visual complexo podem falhar na leitura. Confira a prévia textual antes de preparar a prova.

Com anexos e pesquisa externa desativada, a geração se restringe às fontes lidas. Habilitar pesquisa permite complementação externa e pode acrescentar demora. Sem anexos, o fluxo original continua. O rascunho mantém as fontes da preparação; mudanças posteriores valem para novas provas. Os materiais permanecem privados e não seguem com cópias compartilhadas.

Dependências: [KaTeX (MIT)](https://github.com/KaTeX/KaTeX) e [mathml2omml (LGPL-3.0-or-later)](https://github.com/fiduswriter/mathml2omml), utilizadas sem modificar seus pacotes. As licenças acompanham as dependências.

## Google Drive

Ainda não integrado. A proposta é manter autenticação/metadados no banco relacional e arquivos no Drive, por proprietário/ano/mês. Exige projeto Google Cloud, Drive API, OAuth ou conta de serviço apropriada, credenciais protegidas, consentimento quando aplicável e regras de acesso/cotas. Pastas não substituem autorização. O histórico mensal no site já funciona sem Drive.
