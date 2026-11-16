<?php

/*
 * Configuração / provaai
 * Provedores de IA, executáveis auxiliares e acesso ao legado. Os valores variáveis vêm do
 * ambiente; não coloque segredos diretamente neste arquivo.
 * Ao alterar padrões, confira os serviços consumidores e a configuração do ambiente de teste.
 */


return [
    'gemini_key' => env('GEMINI_API_KEY'),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    'groq_key' => env('GROQ_API_KEY'),
    'groq_model' => 'openai/gpt-oss-120b',
    'mistral_key' => env('MISTRAL_API_KEY'),
    'mistral_model' => env('MISTRAL_MODEL', 'mistral-small-latest'),
    'provider' => env('AI_PROVIDER', 'gemini'),
    'node_binary' => env('NODE_BINARY', 'node'),
    'python_binary' => env('PYTHON_BINARY', 'python3'),
    'legacy_url' => env('LEGACY_SUPABASE_URL'),
    'legacy_key' => env('LEGACY_SUPABASE_SERVICE_KEY'),
];
