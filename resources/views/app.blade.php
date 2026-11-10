<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="description" content="Turmas e provas individuais para aplicar em sala de aula.">
    <title>Provaai · Provas personalizadas</title>
    <link rel="icon" href="/favicon.svg">
    @viteReactRefresh
    @vite('resources/js/app.tsx')
</head>
<body class="antialiased">
    <div id="app">
        {{-- Mesmo estado inicial de ScreenLoader enquanto o navegador carrega o React. --}}
        <div class="motion-root" data-motion="off">
            <div class="screen-loader" data-active="true" aria-hidden="false">
                <div class="loader-character" aria-hidden="true">
                    <img src="/bloub/static/bloub-sonolento.svg" width="152" height="152" alt="">
                    <span class="loader-shadow"></span>
                </div>
                <span class="loader-label" role="status">Carregando sua Provaai…</span>
            </div>
        </div>
    </div>
    <noscript><style>#app { display: none }</style>Ative o JavaScript para usar o Provaai.</noscript>
</body>
</html>
