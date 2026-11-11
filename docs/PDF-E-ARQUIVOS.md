# PDF, modelos e arquivos

PDFs de até 20 MiB podem ser anexados como modelo. O professor seleciona de 5% a 45% do topo da primeira página. Esse cabeçalho preserva a aparência como imagem; as questões do PDF não são extraídas nem enviadas à IA. O corpo novo é diagramado pelo Provaai: não se reproduzem exatamente todas as páginas do original.

PDFs escaneados podem fornecer cabeçalhos visuais. Arquivos protegidos, danificados ou incompatíveis são recusados. A prévia e o cache privado evitam renderizações repetidas.

Na primeira leitura, se o recorte inicial de 25% atravessar uma borda ou linha, o site procura uma faixa em branco nos próximos quatro pontos percentuais da página. O ajuste manual em **Modelos → Ajustar cabeçalho do PDF** usa a altura exata indicada pelo professor.

DOCX serve de modelo de diagramação e referência textual. O conversor abre modelos DOC antigos no LibreOffice e os transforma em DOCX antes de preencher os campos e inserir as questões. Cabeçalhos, rodapés e margens do Word acompanham a exportação. A posição dos campos depende da estrutura do Word original. O texto extraído deve conter de 20 a 60.000 caracteres.

Provas aprovadas podem ser exportadas em PDF e DOCX, com ou sem gabarito. Editar conteúdo, matéria, tópicos ou título devolve a prova ao rascunho. O servidor confere aprovação e propriedade antes de exportar.

Laravel gerencia upload, autorização e download. Arquivos ficam em `storage/app/private/{bucket}/{user_id}/...`, fora de `public/`. Não crie link público dessa pasta. O navegador recebe uma rota que exige sessão, não um link público permanente.

A conversão é um processo Node iniciado por PHP, limitado a 120 segundos. Exportações são temporárias; o conteúdo estruturado fica no banco e pode ser exportado novamente. O cache dura cinco minutos. Testes executaram Word, cabeçalho PDF e exportações PDF/DOCX reais; não cobrem todos os documentos possíveis. A limitação de expansão DOCX está em [Segurança](SEGURANCA.md).

O servidor monta o DOCX uma vez por versão da prova, configuração de modelo e tipo de arquivo do aluno ou gabarito. O PDF usa esse mesmo Word. Documentos com menos de 8 MiB podem ser reaproveitados durante os cinco minutos de cache. O indicador avança nas etapas concluídas de preparação, na transferência dos bytes e na montagem do ZIP. Chega a 100% quando o site entrega o arquivo ao navegador.

## Google Drive

Ainda não integrado. A proposta é manter autenticação/metadados no banco relacional e arquivos no Drive, por proprietário/ano/mês. Exige projeto Google Cloud, Drive API, OAuth ou conta de serviço apropriada, credenciais protegidas, consentimento quando aplicável e regras de acesso/cotas. Pastas não substituem autorização. O histórico mensal no site já funciona sem Drive.
