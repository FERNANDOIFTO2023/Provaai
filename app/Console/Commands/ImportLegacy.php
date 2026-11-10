<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ImportLegacy extends Command
{
    protected $signature = 'provaai:import-legacy {manifest : Caminho do JSON de migração} {--apply : Gravar em um banco novo e copiar arquivos privados}';

    protected $description = 'Valida e importa um backup de usuários, dados e arquivos, preservando UUIDs.';

    private const TABLES = ['sala_templates', 'sala_classes', 'sala_students', 'sala_exams', 'sala_teacher_template_defaults', 'sala_recovery_students', 'sala_copy_invitations'];

    public function handle(): int
    {
        $path = realpath($this->argument('manifest'));
        if (! $path) {
            throw new RuntimeException('Manifesto não encontrado.');
        }
        $backup = json_decode(file_get_contents($path), true, 64, JSON_THROW_ON_ERROR);
        if (($backup['version'] ?? null) !== 1 || ! isset($backup['users'],$backup['tables'],$backup['files'])) {
            throw new RuntimeException('Formato de backup inválido.');
        }
        foreach ($backup['tables']['sala_copy_invitations'] ?? [] as $index => $row) {
            $payload = $row['snapshot'] ?? $row['payload'] ?? [];
            if (is_string($payload)) {
                $payload = json_decode($payload, true, 64, JSON_THROW_ON_ERROR);
            }
            $backup['tables']['sala_copy_invitations'][$index]['snapshot'] = ['class' => $payload['class'] ?? $payload['classroom'] ?? [], 'students' => $payload['students'] ?? []];
            $backup['tables']['sala_copy_invitations'][$index]['destination_id'] = $row['destination_id'] ?? $row['result_class_id'] ?? null;
        }
        $users = [];
        foreach ($backup['users'] as $u) {
            if (! Str::isUuid($u['id'] ?? '') || ! filter_var($u['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('Identidade inválida.');
            }$users[$u['id']] = $u;
        }
        $owned = [];
        foreach (self::TABLES as $table) {
            foreach ($backup['tables'][$table] ?? [] as $row) {
                $owner = $row[$table === 'sala_copy_invitations' ? 'owner_id' : 'user_id'] ?? '';
                if (! isset($users[$owner])) {
                    throw new RuntimeException("Proprietário ausente em $table.");
                }
                if (isset($row['id'])) {
                    $owned[$table][$row['id']] = $owner;
                }
            }
        }
        foreach (self::TABLES as $table) {
            foreach ($backup['tables'][$table] ?? [] as $row) {
                foreach (['class_id' => 'sala_classes', 'student_id' => 'sala_students', 'template_id' => 'sala_templates', 'template_override_id' => 'sala_templates'] as $column => $target) {
                    if (! empty($row[$column]) && ($owned[$target][$row[$column]] ?? null) !== ($row['user_id'] ?? null)) {
                        throw new RuntimeException("Referência sem proprietário correspondente: $table.$column");
                    }
                }
            }
        }
        $root = dirname($path);
        $files = [];
        foreach ($backup['files'] as $f) {
            if (! in_array($f['bucket'] ?? '', ['sala-templates', 'class-banners']) || ! preg_match('~^[a-zA-Z0-9_./-]+$~D', $f['path'] ?? '') || str_contains($f['path'], '..') || ! isset($users[explode('/', $f['path'])[0]])) {
                throw new RuntimeException('Arquivo sem proprietário válido.');
            }
            $source = realpath($root.DIRECTORY_SEPARATOR.$f['source']);
            if (! $source || ! str_starts_with($source, $root.DIRECTORY_SEPARATOR) || ! is_file($source) || ! hash_equals($f['sha256'] ?? '', hash_file('sha256', $source))) {
                throw new RuntimeException('Arquivo ausente ou hash divergente.');
            }
            $files[] = [...$f, 'resolved' => $source];
        }
        $available = array_flip(array_map(fn ($f) => $f['bucket'].'/'.$f['path'], $files));
        foreach ($backup['tables']['sala_templates'] ?? [] as $row) {
            if (! isset($available['sala-templates/'.$row['path']])) {
                throw new RuntimeException('Arquivo de modelo ausente no backup.');
            }
        }
        foreach ($backup['tables']['sala_classes'] ?? [] as $row) {
            if (! empty($row['banner_path']) && ! isset($available['class-banners/'.$row['banner_path']])) {
                throw new RuntimeException('Capa de turma ausente no backup.');
            }
        }
        $this->info(count($users).' usuários; '.array_sum(array_map('count', $backup['tables'])).' registros; '.count($files).' arquivos validados.');
        if (! $this->option('apply')) {
            $this->info('Somente validação. Use --apply em um banco novo após conferir o backup.');

            return self::SUCCESS;
        }
        if (DB::table('users')->exists()) {
            throw new RuntimeException('A importação exige um banco Laravel vazio. Não sobrescreve contas existentes.');
        }
        foreach ($files as $f) {
            if (Storage::disk('local')->exists($f['bucket'].'/'.$f['path'])) {
                throw new RuntimeException('O destino já contém arquivos.');
            }
        }
        $written = [];
        try {
            DB::transaction(function () use ($backup, $users, $files, &$written) {
                foreach ($users as $u) {
                    DB::table('users')->insert(['id' => $u['id'], 'email' => mb_strtolower($u['email']), 'name' => $u['name'] ?? 'Professor', 'email_verified_at' => $u['email_verified_at'] ?? null, 'created_at' => $u['created_at'] ?? now(), 'updated_at' => now()]);
                }
                foreach (self::TABLES as $table) {
                    $columns = array_flip(Schema::getColumnListing($table));
                    foreach ($backup['tables'][$table] ?? [] as $row) {
                        $data = array_intersect_key($row, $columns);
                        foreach ($data as $key => $value) {
                            if (is_array($value)) {
                                $data[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
                            }
                        }
                        DB::table($table)->insert($data);
                    }
                }
                foreach ($files as $f) {
                    $dest = $f['bucket'].'/'.$f['path'];
                    $stream = fopen($f['resolved'], 'rb');
                    try {
                        Storage::disk('local')->put($dest, $stream);
                    } finally {
                        fclose($stream);
                    }$written[] = $dest;
                }
            });
        } catch (\Throwable $e) {
            foreach ($written as $dest) {
                Storage::disk('local')->delete($dest);
            }throw $e;
        }
        $this->info('Importação concluída. Senhas, tokens e sessões antigos não foram importados. Entre por código de e-mail.');

        return self::SUCCESS;
    }
}
