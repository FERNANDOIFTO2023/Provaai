# Revisão e acesso aos downloads

Data: 25/11/2026

## Problema observado

O professor relatou que a aprovação não liberava os formatos de download de forma visível. A versão pública já continha a correção anterior que separa o salvamento do conteúdo da confirmação da aprovação. Os botões continuavam no fim de um editor longo, sujeitos à posição de rolagem. Além disso, as requisições de gravação não tinham limite de espera no cliente.

Na leitura da janela real houve um estado com os botões de salvar e aprovar desabilitados. Na última leitura, ambos estavam habilitados novamente. A tentativa de clicar em “Revisei e aprovo” falhou na ferramenta de automação com `coordinate input geometry is unavailable`; a captura da janela também falhou. Portanto, não foi possível executar esse clique nem determinar a causa da demora do servidor nessa prova. Nenhum conteúdo da prova foi editado pela inspeção.

## Alterações

- A aprovação confirmada abre “Baixar prova aprovada”, com PDF, DOCX e gabarito visíveis em uma tela curta. A troca de diálogo reinicia a rolagem.
- Reabrir uma prova aprovada mostra os formatos diretamente. “Editar prova” retorna ao editor e “Voltar às provas” fecha a janela.
- A edição mantém a regra de nova aprovação. Não há liberação de downloads com base apenas no clique: o servidor precisa devolver a mesma prova com status aprovado.
- Os bloqueios durante geração e download continuam ativos, com uma explicação na tela. A preparação antecipada dos documentos permanece independente da abertura dos botões.
- O salvamento mostra “Salvando a revisão…” e “Confirmando a aprovação…”. Erros recebem foco para não ficarem escondidos no topo do editor.
- Cada requisição de gravação de prova tem prazo de 60 segundos. Ao exceder o prazo, a interface encerra a espera e preserva as alterações exibidas. A mensagem esclarece que o pedido pode ter sido salvo: interromper a espera do navegador não desfaz uma operação já recebida pelo servidor.

Não houve alterações no backend, na geração com Gemini, nos modelos de documentos ou no verificador matemático. O prazo novo é aplicado às gravações de provas, sem alterar os limites próprios de geração e exportação.

## Verificação

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm test` | 68 testes aprovados |
| `npm run test:navigation` | 20 cenários aprovados |
| `npm run build` | Aprovado |
| `git diff --check` | Aprovado |

Os testes de navegador usam o build de produção com dados fictícios e API simulada. Cobrem revisão longa nas larguras de 1440 e 375 px, formatos visíveis sem rolagem, reabertura, edição seguida de nova aprovação, resposta sem confirmação, nova tentativa e download. O teste do cliente verifica o cancelamento da espera e uma tentativa posterior bem-sucedida. Esses testes não comprovam o tempo de resposta da VM ou de conversão de uma prova real.

O build mantém avisos sobre arquivos JavaScript maiores que 500 kB e tempo dos plugins, sem falha de compilação.

## Entrega e limites

Alterações locais na pasta Provaai, sem staging, commit, push ou deploy. A publicação fica com o responsável. A conferência manual do fluxo no site publicado permanece pendente, pois a ferramenta não conseguiu controlar a janela do Chrome. A mudança torna os formatos visíveis após a confirmação e trata esperas excessivas; não representa uma medição ou garantia de maior velocidade de conversão.
