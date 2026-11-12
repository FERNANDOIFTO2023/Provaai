<?php

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
