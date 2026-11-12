<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Seu código de acesso ao Provaai</title>
    <style>
        @media only screen and (max-width: 480px) {
            .email-shell { padding: 16px 12px !important; }
            .email-content { padding: 28px 24px !important; }
            .email-title { font-size: 30px !important; line-height: 36px !important; }
            .email-code { font-size: 36px !important; letter-spacing: 6px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
            .mascot-motion { display: none !important; }
            .mascot-still { display: block !important; max-height: none !important; overflow: visible !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f5;color:#0d1823;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:#f5f3f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Seu código chegou. Volte ao Provaai para continuar. Válido por {{ $validForMinutes }} minutos.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f3f5;">
        <tr><td class="email-shell" align="center" style="padding:40px 16px;">
            <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
                <tr><td style="padding:0 8px 22px;font-family:'Trebuchet MS',Arial,sans-serif;font-size:26px;font-weight:bold;letter-spacing:-1px;color:#5210ce;">provaai<span style="color:#115c4c;">.</span></td></tr>
                <tr><td class="email-content" style="padding:36px 40px;background-color:#ffffff;border:1px solid #dad6df;border-top:5px solid #5210ce;border-radius:24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                            <td valign="middle" style="font-size:11px;line-height:18px;letter-spacing:2px;font-weight:bold;color:#5210ce;">SUA PRÓXIMA AULA<br>COMEÇA AQUI</td>
                            <td width="96" align="right">
                                <img class="mascot-motion" src="{{ $message->embed(public_path('email/bloub-login.gif')) }}" width="96" height="96" alt="" style="display:block;border:0;width:96px;height:96px;">
                                <div class="mascot-still" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><img src="{{ $message->embed(public_path('email/bloub-login.png')) }}" width="96" height="96" alt="" style="display:block;border:0;"></div>
                            </td>
                        </tr>
                    </table>
                    <h1 class="email-title" style="margin:20px 0 16px;font-family:'Trebuchet MS',Arial,sans-serif;font-size:38px;line-height:44px;font-weight:bold;letter-spacing:-1px;color:#0d1823;">Seu código chegou<span style="color:#5210ce;">.</span></h1>
                    <p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#505866;">Falta só um passo para entrar. Use o código abaixo na tela de acesso do Provaai.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eee8fa;border:1px solid #d8c9f2;border-radius:16px;">
                        <tr><td align="center" style="padding:22px 12px 8px;font-size:11px;line-height:16px;letter-spacing:2px;color:#5210ce;font-weight:bold;">CÓDIGO DE ACESSO</td></tr>
                        <tr><td class="email-code" align="center" dir="ltr" style="padding:0 12px 16px;font-family:'Courier New',monospace;font-size:44px;line-height:54px;letter-spacing:8px;font-weight:bold;color:#5210ce;white-space:nowrap;">{{ $code }}</td></tr>
                        <tr><td align="center" style="padding:0 12px 22px;font-size:13px;line-height:20px;color:#505866;">Válido por <strong>{{ $validForMinutes }} minutos</strong> a partir da solicitação.</td></tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:14px;line-height:23px;color:#505866;">Copie os seis números e volte à aba em que você pediu o código. Se ele expirar, solicite outro por lá.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                        <tr><td style="border-top:1px solid #dad6df;padding-top:24px;font-size:14px;line-height:23px;color:#0d1823;">Menos tempo preparando.<br><strong>Mais tempo ensinando.</strong></td></tr>
                    </table>
                </td></tr>
                <tr><td align="center" style="padding:24px 20px 0;font-size:12px;line-height:20px;color:#505866;">
                    <strong>Este código é só seu. Não compartilhe.</strong><br>
                    Não pediu este acesso? Pode ignorar este e-mail.<br>
                    Sua conta só será acessada com o código.
                </td></tr>
                <tr><td align="center" style="padding:18px 20px 0;font-size:11px;line-height:18px;color:#505866;">Provaai · Provas personalizadas, do seu jeito.</td></tr>
            </table>
            <!--[if mso]></td></tr></table><![endif]-->
        </td></tr>
    </table>
</body>
</html>
