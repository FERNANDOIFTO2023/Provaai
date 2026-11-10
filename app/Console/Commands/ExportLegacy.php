<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ExportLegacy extends Command
{
    protected $signature = 'provaai:export-supabase {directory : Pasta nova, fora do repositório}';

    protected $description = 'Exporta dados e arquivos vinculados do legado Supabase, sem alterá-lo.';

    public function handle(): int
    {
        $url = rtrim((string) config('provaai.legacy_url'), '/');
        $key = config('provaai.legacy_key');
        if (! preg_match('~^https://[a-z0-9-]+\.supabase\.co$~D', $url) || ! $key) {
            throw new RuntimeException('Configure LEGACY_SUPABASE_URL e LEGACY_SUPABASE_SERVICE_KEY apenas no ambiente de migração.');
        }
        $directory = $this->argument('directory');
        if (file_exists($directory)) {
            throw new RuntimeException('Escolha uma pasta nova para preservar backups anteriores.');
        }
        if (! mkdir($directory, 0700, true)) {
            throw new RuntimeException('Não foi possível criar o backup.');
        }
        $get = function (string $path, array $query = []) use ($url, $key) {
            $response = Http::connectTimeout(10)->timeout(90)->withToken($key)->withHeaders(['apikey' => $key])->get($url.$path, $query);
            if (! $response->successful()) {
                throw new RuntimeException('Falha ao ler o legado (HTTP '.$response->status().'). Backup incompleto; mantenha o site antigo ativo.');
            }

            return $response;
        };
        $backup = ['version' => 1, 'users' => [], 'tables' => [], 'files' => []];
        for ($page = 1; ; $page++) {
            $users = $get('/auth/v1/admin/users', ['page' => $page, 'per_page' => 100])->json('users');
            if (! is_array($users)) {
                throw new RuntimeException('Resposta de usuários inválida.');
            }
            foreach ($users as $u) {
                $backup['users'][] = ['id' => $u['id'], 'email' => $u['email'], 'name' => $u['user_metadata']['full_name'] ?? explode('@', $u['email'])[0], 'email_verified_at' => $u['email_confirmed_at'] ?? null, 'created_at' => $u['created_at']];
            }
            if (count($users) < 100) {
                break;
            }
        }
        $tables = ['sala_templates', 'sala_classes', 'sala_students', 'sala_exams', 'sala_teacher_template_defaults', 'sala_recovery_students', 'sala_copy_invitations'];
        foreach ($tables as $table) {
            $rows = [];
            $order = match ($table) {
                'sala_teacher_template_defaults' => 'user_id','sala_recovery_students' => 'student_id',default => 'id'
            };
            do {
                $chunk = $get('/rest/v1/'.$table, ['select' => '*', 'order' => $order.'.asc', 'offset' => count($rows), 'limit' => 100])->json();
                if (! is_array($chunk) || ! array_is_list($chunk)) {
                    throw new RuntimeException('Resposta de registros inválida.');
                }
                array_push($rows, ...$chunk);
            } while (count($chunk) === 100);
            $backup['tables'][$table] = $rows;
            $this->info($table.': '.count($rows));
        }
        $paths = [];
        foreach ($backup['tables']['sala_templates'] as $row) {
            $paths['sala-templates/'.$row['path']] = ['bucket' => 'sala-templates', 'path' => $row['path']];
        }
        foreach ($backup['tables']['sala_classes'] as $row) {
            if (! empty($row['banner_path'])) {
                $paths['class-banners/'.$row['banner_path']] = ['bucket' => 'class-banners', 'path' => $row['banner_path']];
            }
        }
        mkdir($directory.'/files', 0700);
        foreach ($paths as $remote => $file) {
            $source = 'files/'.hash('sha256', $remote);
            $bytes = $get('/storage/v1/object/authenticated/'.implode('/', array_map('rawurlencode', explode('/', $remote))))->body();
            if (file_put_contents($directory.'/'.$source, $bytes) === false) {
                throw new RuntimeException('Não foi possível gravar arquivo de backup.');
            }
            $backup['files'][] = [...$file, 'source' => $source, 'sha256' => hash('sha256', $bytes)];
        }
        if (file_put_contents($directory.'/manifest.json', json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)) === false) {
            throw new RuntimeException('Não foi possível gravar o manifesto.');
        }
        $this->info('Manifesto concluído. Execute import-legacy sem --apply para validar. O backup contém dados privados; não publique no Git.');

        return self::SUCCESS;
    }
}
