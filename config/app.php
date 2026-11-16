<?php

/*
 * Configuração / app
 * Identidade da aplicação, idioma, fuso e criptografia. Os valores variáveis vêm do ambiente; não
 * coloque segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


return [

    /*
     * Nome apresentado pelo framework em notificações e elementos que identificam a aplicação.
     */

    'name' => env('APP_NAME', 'Laravel'),

    /*
     * Ambiente de execução definido no .env. Serviços podem mudar de comportamento entre
     * desenvolvimento, teste e produção.
     */

    'env' => env('APP_ENV', 'production'),

    /*
     * Detalhamento de erros e pilhas de execução. Em produção deve ficar desabilitado para não
     * expor dados internos.
     */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
     * Endereço base usado principalmente para gerar URLs em comandos Artisan, fora de uma
     * requisição HTTP.
     */

    'url' => env('APP_URL', 'http://localhost'),

    /*
     * Fuso padrão do PHP e das datas do backend. A interface aplica seu próprio fuso ao
     * organizar o histórico de provas.
     */

    'timezone' => 'UTC',

    /*
     * Idioma padrão, idioma alternativo e localização dos dados fictícios gerados pelo Faker.
     */

    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    /*
     * Chave e algoritmo usados pelo Laravel para criptografia. Chaves anteriores permitem ler
     * dados durante uma rotação planejada.
     */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
     * Armazenamento do estado de manutenção. O driver de cache permite compartilhar esse estado
     * entre instâncias.
     */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];
