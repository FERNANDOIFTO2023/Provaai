# Modelos PDF, organização mensal e armazenamento

Atualizado em 09/11/2026.

## PDF como modelo visual

O PDF fornece apenas a faixa superior da primeira página e o tamanho da página. Não fornece questões, textos nem orientações para a IA. Isso também vale para modelos antigos que já tenham texto extraído salvo.

1. Envie um PDF legível, sem senha, com até 20 MB, em Modelos.
2. Abra **Ajustar cabeçalho do PDF**. O recorte inicial é de 25% da altura; pode variar entre 5% e 45%.
3. Clique em **Ver prévia**, ajuste para deixar todas as questões antigas fora da imagem e clique em **Salvar cabeçalho**.
4. Escolha o modelo, prepare e aprove a prova. Baixe PDF ou DOCX.

O recorte é convertido em imagem antes de entrar no arquivo novo. Assim, texto oculto, perguntas abaixo do recorte, links, anexos e ações do PDF original não são copiados para a prova exportada. Logos, cores e a aparência da área selecionada são preservados visualmente. O cabeçalho se repete em todas as páginas; as questões usam a diagramação do Provaai, abaixo dele. Não se reproduzem rodapés nem a diagramação do corpo do PDF original. Campos preenchidos no cabeçalho permanecem na imagem: use um cabeçalho sem nomes reais e confira a prévia. O texto da imagem não é editável no DOCX.

O PDF é validado/renderizado no servidor Next.js, sem consumir Gemini ou Groq. PDFs escaneados podem fornecer o cabeçalho como imagem. PDFs danificados ou protegidos são recusados. A biblioteca trata rotação da página. A geração continua validando a matéria e os tópicos informados pelo professor.

### Correções e verificação

Antes, o PDF era transcrito pela IA e suas perguntas podiam entrar no contexto da geração; a exportação usava o layout padrão, sem o cabeçalho original. Agora o arquivo serve apenas como modelo visual e tem recorte ajustável. O limite anterior de 14 MB para envio ao Gemini deixa de se aplicar ao fluxo de PDF do site.

Testes automatizados processam um PDF sintético com cabeçalho colorido, questões antigas e várias páginas. Conferem a repetição da imagem, posição das questões abaixo dela, ausência do texto antigo na saída, separação de prova/gabarito e cabeçalho no DOCX. Outros testes verificam que a geração não envia transcrições antigas à IA, e que PDFs inválidos e recortes fora do intervalo são recusados. Também há teste de imagem escaneada com mais de 4 milhões de pixels. Após `npm run build`, execute `node --experimental-strip-types tests/pdf-build-smoke.mjs`: esse teste usa respostas locais simuladas nas rotas compiladas, gera a prévia PNG e converte uma prova de várias páginas com LibreOffice, verificando cabeçalho, Unicode e ausência de perguntas antigas/gabarito. Detectou e corrigiu a transformação de `require.resolve` em identificador numérico pelo Turbopack; os assets agora usam a pasta incluída no pacote de produção. Não há garantia de compatibilidade com todo PDF existente: sempre confira a prévia e o arquivo final.

Publicação: aplicar `20261109000100_pdf_header_layout.sql`, publicar ambas as funções de IA com o módulo compartilhado atualizado e publicar o Next.js com suas dependências e assets do PDF.js. A coluna nova herda a RLS e os privilégios da tabela de modelos. Aplicado em 09/11/2026; funções sala-ai v7 e sala-ai-mistral v4 ativas. Deploy Vercel `dpl_6hNzbhdGSXyXNpYAQpaLPAytRkHR` concluído (READY), associado a provaai.vercel.app. A publicação usou os arquivos locais; commit/push dessas alterações ao GitHub ainda não foi feito.

## Provas por mês

As listas de provas coletivas e o histórico individual são separados por mês e ano, em ordem decrescente, usando `created_at` no fuso `America/Sao_Paulo`. Busca, status, seleção e download continuam atuando sobre as mesmas provas. Editar uma prova não muda seu mês de criação. Datas inválidas ficam em “Data não informada”. Nenhuma mudança de armazenamento é necessária para esse agrupamento.

## Google Drive: proposta, ainda não ativada

É possível usar Drive para os arquivos e Supabase para autenticação, permissões, turmas, alunos, questões editáveis e índice das versões. Drive seria o armazenamento de arquivos; os dados relacionais e as regras de acesso continuariam no banco.

Organização sugerida: `Provaai/professor@email/2026/11-Novembro/09/prova_<id>_v1.pdf`, com o gabarito separado. O vínculo de autorização deve usar o `user_id` imutável do Supabase; o e-mail é apenas o nome legível da pasta. Trocar de e-mail não deve conceder arquivos a outra conta.

Para um Drive central, uma conta Google administradora autoriza a aplicação por OAuth; seus tokens ficam exclusivamente no servidor. A API permite criar pastas e arquivos com acesso limitado pelo escopo `drive.file`. Contas de serviço não têm cota própria de armazenamento: precisam de um drive compartilhado ou de autorização em nome de uma pessoa. Há limites de espaço e de requisições; não se deve prometer armazenamento gratuito ilimitado.

O índice no Supabase deve guardar dono, prova, versão, formato, `fileId`, pasta, data, tamanho, hash e estado da sincronização. Uploads precisam ser idempotentes e retomáveis; downloads passam por verificação de propriedade. Não tornar arquivos públicos nem usar apenas o nome da pasta como permissão. Antes de remover cópias existentes, verificar upload e integridade; definir também exclusão, retenção, revogação do Google e recuperação de arquivos removidos manualmente.

Para ativar faltam escolher a conta central e configurar um projeto Google Cloud com Drive API, consentimento OAuth e credenciais privadas. Nenhum arquivo ou dado de usuário foi migrado neste trabalho.

Fontes: [pastas na Drive API](https://developers.google.com/workspace/drive/api/guides/folder), [escopo drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [cotas e contas de serviço](https://developers.google.com/workspace/drive/api/guides/handle-errors#storageQuotaExceeded).
