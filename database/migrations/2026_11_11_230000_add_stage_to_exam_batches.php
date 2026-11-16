<?php

/*
 * Banco / evolução do schema
 * Acrescenta a etapa atual ao progresso do lote, permitindo distinguir geração e conferência na
 * interface.
 * up aplica a mudança e down a reverte. Em bancos já publicados, evolua o schema com uma nova
 * migração em vez de reescrever esta.
 */


use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sala_exam_batches', function (Blueprint $table) {
            $table->string('stage', 16)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sala_exam_batches', function (Blueprint $table) {
            $table->dropColumn('stage');
        });
    }
};
