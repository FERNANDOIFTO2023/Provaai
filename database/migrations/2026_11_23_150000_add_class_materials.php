<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sala_classes', fn (Blueprint $t) => $t->boolean('allow_external_sources')->default(false));
        Schema::create('sala_class_materials', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('class_id')->constrained('sala_classes')->cascadeOnDelete();
            $t->string('filename');
            $t->string('path')->unique();
            $t->unsignedInteger('size');
            $t->mediumText('extracted_text');
            $t->index(['user_id', 'class_id']);
            $t->timestamps();
        });
        Schema::table('sala_exams', function (Blueprint $t) {
            // Null mantém compatibilidade com provas anteriores à inclusão dos materiais.
            $t->json('source_snapshot')->nullable();
            $t->json('external_research')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sala_exams', fn (Blueprint $t) => $t->dropColumn(['source_snapshot', 'external_research']));
        Schema::dropIfExists('sala_class_materials');
        Schema::table('sala_classes', fn (Blueprint $t) => $t->dropColumn('allow_external_sources'));
    }
};
