<?php

/*
 * Configuração / auth
 * Guardas de sessão e provedor de usuários. Os valores variáveis vêm do ambiente; não coloque
 * segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


use App\Models\User;

return [

    /*
     * Guarda e mecanismo de redefinição de senha usados por padrão pelo Laravel. O login por
     * código da aplicação fica no AuthController.
     */

    'defaults' => [
        'guard' => env('AUTH_GUARD', 'web'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    /*
     * Define como a requisição é autenticada. A guarda web usa sessão e obtém a conta pelo
     * provedor users.
     */

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
    ],

    /*
     * Define como as contas são recuperadas. O provedor Eloquent usa o modelo configurado para
     * representar o professor.
     */

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => env('AUTH_MODEL', User::class),
        ],

        // 'users' => [
        //     'driver' => 'database',
        //     'table' => 'users',
        // ],
    ],

    /*
     * Configuração padrão do framework para tokens de redefinição. expire usa minutos; throttle
     * usa segundos. Esse mecanismo é distinto do código de acesso por e-mail do Provaai.
     */

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => env('AUTH_PASSWORD_RESET_TOKEN_TABLE', 'password_reset_tokens'),
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    /*
     * Tempo em segundos pelo qual uma confirmação de senha é considerada recente nas
     * funcionalidades que a exigirem.
     */

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

];
