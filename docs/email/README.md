# E-mail de acesso · Provaai

O pedido de código do Laravel envia `App\Mail\LoginCode`, com HTML e texto simples. O prazo de dez minutos é compartilhado entre o controller e o e-mail. Reutilização de código vigente, limite de envios, rotação e verificação continuam no fluxo existente.

## Visual e movimento

O layout usa as cores da marca, Trebuchet MS/Segoe UI com fontes de reserva, tabelas de apresentação e estilos inline. O código fica em texto selecionável e não depende de imagens, JavaScript ou botões de copiar. As imagens são incorporadas à mensagem por CID; não dependem do domínio ou de rastreadores externos.

O SVG animado original é `public/bloub/animated/bloub-feliz.svg`. A versão enviada é `public/email/bloub-login.gif`: 192 × 192 px, exibida a 96 px, 2,4 segundos por reprodução, duas reproduções. O primeiro e o último quadro têm o mascote completo. A alternativa PNG aparece com `prefers-reduced-motion` nos leitores que respeitam essa consulta. Em leitores que não animam GIFs, o primeiro quadro permanece útil.

SVG embutido tem suporte desigual e não deve carregar conteúdo essencial de autenticação. GIF possui suporte mais amplo, com limitações de animação em versões do Outlook. Referências consultadas em 12/11/2026: [SVG](https://www.caniemail.com/features/html-svg/) e [GIF](https://www.caniemail.com/features/image-gif/). A compatibilidade foi avaliada por essas referências; não foi feito teste visual em cada cliente de e-mail.

## Prévia e verificações

- `php docs/email/render-preview.php`: renderiza o template real usando transporte em memória, destinatário fictício e código de exemplo. Não envia e-mails.
- Abra `docs/email/preview.html`; `preview.txt` contém a alternativa textual.
- `node docs/email/render-assets.mjs`: regenera PNG/GIF; requer FFmpeg (`FFMPEG_PATH` ou o executável já utilizado em `docs/motion`).
- `node docs/email/verify-preview.mjs`: verifica 320, 375, 600 e 900 px, imagens bloqueadas e movimento reduzido. Requer Playwright; `PLAYWRIGHT_MODULE` e `CHROME_PATH` permitem usar instalações existentes.
- `php artisan test`: inclui o envio pelo transporte em memória, MIME HTML/texto, imagens inline e login com o código extraído da mensagem.

## Publicação

O envio real acontece no Laravel da AWS. A produção acompanha `main` por `provaai-producao-release.timer` depois do workflow `validate.yml` passar. O Docker inclui o mailable, os templates e as imagens; não há migração de banco ou alteração de credenciais SMTP nesta entrega. O Figma não controla o envio.

A criação no Figma foi adiada pelo usuário após a integração exigir reautenticação. O HTML, as prévias e o SVG existente ficam disponíveis localmente para continuar esse trabalho.
