<?php

/*
 * Banco / evolução do schema
 * Cria armazenamento de cache e bloqueios para instalações que usam o driver de banco.
 * up aplica a mudança e down a reverte. Em bancos já publicados, evolua o schema com uma nova
 * migração em vez de reescrever esta.
 */


use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aplica as alterações de estrutura ao banco.
     */
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->bigInteger('expiration')->index();
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->bigInteger('expiration')->index();
        });
    }

    /**
     * Reverte as alterações estruturais desta migração.
     */
    public function down(): void
    {
        Schema::dropIfExists('cache');
        Schema::dropIfExists('cache_locks');
    }
};
