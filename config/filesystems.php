<?php

/*
 * Configuração / filesystems
 * Discos privados e públicos de arquivos. Os valores variáveis vêm do ambiente; não coloque
 * segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


return [

    /*
     * Disco padrão de arquivos. Os documentos e capas privados da aplicação são acessados por
     * rotas autenticadas.
     */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
     * Configura discos locais ou remotos, raízes e visibilidade. Alterar a raiz pode tornar
     * arquivos existentes inacessíveis.
     */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => false,
            'throw' => true,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
     * Links criados por storage:link para conteúdo público. Não inclua o diretório privado de
     * modelos e documentos.
     */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
