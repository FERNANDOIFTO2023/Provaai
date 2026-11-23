<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Registra apenas métricas, sem enunciados, anexos, respostas ou chaves de API. */
    public function up(): void
    {
        Schema::create('ai_usage_events', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('provider', 30);
            $t->string('model', 150);
            $t->string('stage', 30);
            $t->unsignedBigInteger('input_tokens')->nullable();
            $t->unsignedBigInteger('output_tokens')->nullable();
            $t->unsignedBigInteger('total_tokens')->nullable();
            $t->unsignedInteger('duration_ms');
            $t->unsignedSmallInteger('http_status')->nullable();
            $t->timestamp('created_at');
            $t->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_events');
    }
};
