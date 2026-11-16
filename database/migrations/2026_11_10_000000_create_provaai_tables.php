<?php

/*
 * Banco / evolução do schema
 * Cria os registros de negócio, vínculos de propriedade, códigos de acesso e auditoria de exclusão.
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
        // Código temporário: guarda resumo, validade e tentativas por e-mail.
        Schema::create('login_codes', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('digest');
            $t->timestamp('expires_at');
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamps();
        });
        // Arquivos privados e resultado da leitura do modelo.
        Schema::create('sala_templates', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('name', 150);
            $t->string('filename');
            $t->string('path')->unique();
            $t->text('reference_text')->default('');
            $t->text('extracted_text')->default('');
            $t->string('processing_status')->default('pending');
            $t->text('processing_error')->nullable();
            $t->double('pdf_header_ratio')->default(.25);
            $t->timestamps();
        });
        // Turma, identidade visual, preferência de modelo e prazo de arquivamento.
        Schema::create('sala_classes', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->string('name', 80);
            $t->string('grade', 80);
            $t->string('subject', 80);
            $t->string('period', 40)->default('');
            $t->string('color')->default('sage');
            $t->string('icon')->default('book');
            $t->string('banner_path')->nullable();
            $t->json('banner_crop')->nullable();
            $t->foreignUuid('template_override_id')->nullable()->constrained('sala_templates')->nullOnDelete();
            $t->boolean('use_provaai_template')->default(false);
            $t->timestamp('archived_at')->nullable();
            $t->timestamp('deletion_due_at')->nullable()->index();
            $t->timestamps();
        });
        // Perfil pedagógico; a restrição composta impede código duplicado na mesma turma.
        Schema::create('sala_students', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('class_id')->constrained('sala_classes')->cascadeOnDelete();
            $t->string('name', 100);
            $t->string('code', 30);
            $t->text('difficulties')->default('');
            $t->text('criteria')->default('');
            $t->string('level')->default('Intermediário');
            $t->timestamp('archived_at')->nullable();
            $t->timestamps();
            $t->unique(['class_id', 'code']);
        });
        // Prova e snapshot do perfil usados na preparação, independentes das edições futuras do cadastro.
        Schema::create('sala_exams', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('class_id')->constrained('sala_classes')->cascadeOnDelete();
            $t->foreignUuid('student_id')->constrained('sala_students')->cascadeOnDelete();
            $t->foreignUuid('template_id')->nullable()->constrained('sala_templates')->nullOnDelete();
            $t->string('title', 150);
            $t->string('subject', 80);
            $t->text('topics');
            $t->unsignedInteger('question_count');
            $t->string('purpose')->default('regular');
            $t->string('status')->default('draft');
            $t->json('content');
            $t->json('profile_snapshot');
            $t->timestamps();
            $t->index(['user_id', 'class_id', 'subject']);
        });
        // Uma preferência de modelo por professor; null representa ausência de modelo externo.
        Schema::create('sala_teacher_template_defaults', function (Blueprint $t) {
            $t->foreignUuid('user_id')->primary()->constrained()->cascadeOnDelete();
            $t->foreignUuid('template_id')->nullable()->constrained('sala_templates')->nullOnDelete();
            $t->timestamps();
        });
        // Participação em provas individuais sem criar um segundo cadastro do aluno.
        Schema::create('sala_recovery_students', function (Blueprint $t) {
            $t->foreignUuid('student_id')->primary()->constrained('sala_students')->cascadeOnDelete();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
        });
        // Um lote por professor e reserva temporária para impedir execução simultânea de uma etapa.
        Schema::create('sala_exam_batches', function (Blueprint $t) {
            $t->foreignUuid('user_id')->primary()->constrained()->cascadeOnDelete();
            $t->uuid('batch_id')->unique();
            $t->string('title');
            $t->json('exam_ids');
            $t->unsignedInteger('completed')->default(0);
            $t->unsignedInteger('failed')->default(0);
            $t->text('last_error')->nullable();
            $t->uuid('lease')->nullable();
            $t->timestamp('lease_until')->nullable();
            $t->timestamps();
        });
        // Convite guarda os dados no momento do envio e o estado de aceite ou revogação.
        Schema::create('sala_copy_invitations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('owner_id')->constrained('users')->cascadeOnDelete();
            $t->string('sender_email');
            $t->string('recipient_email')->index();
            $t->string('kind');
            $t->string('resource_name');
            $t->unsignedInteger('student_count');
            $t->json('snapshot');
            $t->uuid('destination_id')->nullable();
            $t->timestamp('accepted_at')->nullable();
            $t->timestamp('revoked_at')->nullable();
            $t->timestamps();
        });
        // Registro de auditoria sem vínculo com exclusão em cascata da turma, preservando seu motivo.
        Schema::create('class_deletion_audits', function (Blueprint $t) {
            $t->id();
            $t->uuid('user_id')->index();
            $t->uuid('class_id');
            $t->string('class_name');
            $t->text('reason');
            $t->timestamp('deleted_at');
        });
    }

    public function down(): void
    {
        foreach (['class_deletion_audits', 'sala_copy_invitations', 'sala_exam_batches', 'sala_recovery_students',
            'sala_teacher_template_defaults', 'sala_exams', 'sala_students', 'sala_classes', 'sala_templates', 'login_codes'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
