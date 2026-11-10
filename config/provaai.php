<?php

return [
    'gemini_key' => env('GEMINI_API_KEY'),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    'groq_key' => env('GROQ_API_KEY'),
    'groq_model' => 'openai/gpt-oss-120b',
    'mistral_key' => env('MISTRAL_API_KEY'),
    'mistral_model' => env('MISTRAL_MODEL', 'mistral-small-latest'),
    'provider' => env('AI_PROVIDER', 'gemini'),
    'node_binary' => env('NODE_BINARY', 'node'),
    'legacy_url' => env('LEGACY_SUPABASE_URL'),
    'legacy_key' => env('LEGACY_SUPABASE_SERVICE_KEY'),
];
