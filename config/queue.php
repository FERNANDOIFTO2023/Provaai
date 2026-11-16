<?php

/*
 * Configuração / queue
 * Conexões de fila, retentativas e registro de falhas. Os valores variáveis vêm do ambiente; não
 * coloque segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


return [

    /*
     * Conexão padrão que recebe tarefas assíncronas, como a geração de provas em lote.
     */

    'default' => env('QUEUE_CONNECTION', 'database'),

    /*
     * Drivers de execução disponíveis. sync executa imediatamente; drivers persistentes
     * dependem de um trabalhador ativo e prazos de reserva coerentes.
     */

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => env('DB_QUEUE', 'default'),
            'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 90),
            'after_commit' => false,
        ],

        // Fila própria para documentos: não ocupa o trabalhador da geração com IA.
        // Mantém a reserva maior que o timeout e usa as tabelas existentes da aplicação.
        'documents' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => 'documents',
            'retry_after' => 480,
            'after_commit' => true,
        ],

        'beanstalkd' => [
            'driver' => 'beanstalkd',
            'host' => env('BEANSTALKD_QUEUE_HOST', 'localhost'),
            'queue' => env('BEANSTALKD_QUEUE', 'default'),
            'retry_after' => (int) env('BEANSTALKD_QUEUE_RETRY_AFTER', 90),
            'block_for' => 0,
            'after_commit' => false,
        ],

        'sqs' => [
            'driver' => 'sqs',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/your-account-id'),
            'queue' => env('SQS_QUEUE', 'default'),
            'suffix' => env('SQS_SUFFIX'),
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'after_commit' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => (int) env('REDIS_QUEUE_RETRY_AFTER', 90),
            'block_for' => null,
            'after_commit' => false,
        ],

        'deferred' => [
            'driver' => 'deferred',
        ],

        'background' => [
            'driver' => 'background',
        ],

        'failover' => [
            'driver' => 'failover',
            'connections' => [
                'database',
                'deferred',
            ],
        ],

    ],

    /*
     * Banco e tabela dos lotes internos do framework. São diferentes de sala_exam_batches, que
     * guarda o progresso de negócio do Provaai.
     */

    'batching' => [
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'job_batches',
    ],

    /*
     * Armazenamento das tarefas que falharam para diagnóstico e eventual nova tentativa. Evite
     * expor esses registros publicamente.
     */

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'failed_jobs',
    ],

];
