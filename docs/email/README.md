# E-mail de acesso · Provaai

O pedido de código do Laravel envia `App\Mail\LoginCode`, com HTML e texto simples. O prazo de dez minutos é compartilhado entre o controller e o e-mail. Reutilização de código vigente, limite de envios, rotação e verificação continuam no fluxo existente.

## Identidade visual

O cabeçalho roxo apresenta a marca **Provaai.** com ponto e acabamento verde-menta. O código aparece em texto selecionável sobre fundo menta claro, seguido do prazo de validade e das instruções de acesso. O layout usa Trebuchet MS/Segoe UI com fontes de reserva, tabelas de apresentação e estilos inline.

O e-mail não incorpora mascote, GIF, PNG, SVG, scripts ou imagens externas. A leitura e o uso do código independem do carregamento de imagens. Os arquivos antigos em `public/email` e seu gerador permanecem como acervo; não são anexados às mensagens.

## Prévia e verificações

- `php docs/email/render-preview.php`: renderiza o template real pelo transporte em memória, com destinatário fictício e código de exemplo. Não envia e-mails nem grava códigos de login. Requer PHP 8.3 ou superior.
- Abra `docs/email/preview.html`; `preview.txt` contém a alternativa textual. As imagens `preview-375.png` e `preview-900.png` mostram celular e computador.
- `node docs/email/verify-preview.mjs`: verifica 320, 375, 600 e 900 px, ausência de imagens e de rolagem horizontal, título visível e código selecionável. Requer Playwright; `PLAYWRIGHT_MODULE` e `CHROME_PATH` permitem usar instalações existentes.
- `php artisan test --filter=LoginCodeMailTest`: confere HTML/texto, ausência de anexos, uso do código recebido, expiração, rotação e falha de envio.

As prévias foram verificadas no Chrome. A aparência pode variar conforme o cliente de e-mail; não houve envio real nem conferência em todas as versões de Gmail e Outlook nesta alteração.

## Publicação

O envio real acontece no Laravel da AWS. A produção acompanha `main` por `provaai-producao-release.timer` depois do workflow `validate.yml` passar. O Docker inclui o mailable e os templates; esta alteração não requer migração de banco ou mudança de credenciais SMTP.

Em 12/11/2026, o template foi atualizado diretamente no contêiner de produção, com backup e limpeza das views compiladas. O arquivo do projeto contém a mesma versão para o próximo commit do responsável. A aplicação direta sobrevive ao reinício do contêiner, mas sua recriação com uma imagem antiga restaura o layout anterior. Para tornar a alteração parte das próximas versões, inclua estes arquivos no commit e no push pelo GitHub Desktop.
