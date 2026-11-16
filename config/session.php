<?php

/*
 * Configuração / session
 * Persistência, duração e atributos do cookie de sessão. Os valores variáveis vêm do ambiente; não
 * coloque segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


use Illuminate\Support\Str;

return [

    /*
     * Seleciona onde os dados de sessão são persistidos. O cookie identifica a sessão; o driver
     * define o armazenamento correspondente.
     */

    'driver' => env('SESSION_DRIVER', 'database'),

    /*
     * Validade da sessão do servidor em minutos e opção de encerrar ao fechar o navegador. Não
     * confundir com o relógio de inatividade da interface.
     */

    'lifetime' => (int) env('SESSION_LIFETIME', 120),

    'expire_on_close' => env('SESSION_EXPIRE_ON_CLOSE', false),

    /*
     * Controla a criptografia dos dados persistidos da sessão antes de gravá-los no
     * armazenamento.
     */

    'encrypt' => env('SESSION_ENCRYPT', false),

    /*
     * Diretório usado quando o driver de sessão é file. Precisa permitir escrita pelo processo
     * da aplicação.
     */

    'files' => storage_path('framework/sessions'),

    /*
     * Conexão usada por sessões em banco ou Redis. Ausência de valor mantém a conexão padrão
     * correspondente.
     */

    'connection' => env('SESSION_CONNECTION'),

    /*
     * Nome da tabela para o driver database; deve corresponder à estrutura criada pelas
     * migrações.
     */

    'table' => env('SESSION_TABLE', 'sessions'),

    /*
     * Armazenamento usado pelos drivers de sessão baseados em cache, como Redis e Memcached.
     */

    'store' => env('SESSION_STORE'),

    /*
     * Probabilidade de limpar sessões expiradas durante uma requisição, expressa como chances
     * sobre o total.
     */

    'lottery' => [2, 100],

    /*
     * Nome do cookie de sessão. Use nomes distintos se várias aplicações compartilharem o mesmo
     * domínio.
     */

    'cookie' => env(
        'SESSION_COOKIE',
        Str::slug((string) env('APP_NAME', 'laravel')).'-session'
    ),

    /*
     * Caminho do site no qual o navegador envia o cookie de sessão.
     */

    'path' => env('SESSION_PATH', '/'),

    /*
     * Domínio e subdomínios autorizados a receber o cookie. null mantém o domínio corrente.
     */

    'domain' => env('SESSION_DOMAIN'),

    /*
     * Quando habilitado, o navegador só envia o cookie por HTTPS. Deve acompanhar a
     * configuração real da instalação.
     */

    'secure' => env('SESSION_SECURE_COOKIE'),

    /*
     * Impede leitura do cookie por JavaScript. A interface usa um marcador público e não
     * precisa acessar a credencial real.
     */

    'http_only' => env('SESSION_HTTP_ONLY', true),

    /*
     * Política de envio do cookie em navegação entre sites. Valores possíveis: lax, strict,
     * none ou null; confira o fluxo de autenticação antes de alterar.
     */

    'same_site' => env('SESSION_SAME_SITE', 'lax'),

    /*
     * Vincula o cookie ao site de nível superior em contextos de terceiros. Requer
     * compatibilidade com Secure e SameSite=None.
     */

    'partitioned' => env('SESSION_PARTITIONED_COOKIE', false),

    /*
     * Formato de serialização dos dados de sessão: json ou php. Alterá-lo afeta a leitura de
     * sessões existentes.
     */

    'serialization' => 'json',

];
