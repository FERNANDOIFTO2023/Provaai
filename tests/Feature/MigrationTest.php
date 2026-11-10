<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class MigrationTest extends TestCase
{
    use RefreshDatabase;

    private array $temporary = [];

    protected function tearDown(): void
    {
        foreach ($this->temporary as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        parent::tearDown();
    }

    private function backup(): array
    {
        $owner = (string) Str::uuid();
        $class = (string) Str::uuid();
        $invite = (string) Str::uuid();

        return ['version' => 1, 'users' => [['id' => $owner, 'email' => 'origem@example.test', 'name' => 'Origem']],
            'tables' => ['sala_classes' => [['id' => $class, 'user_id' => $owner, 'name' => '7 A', 'grade' => '7', 'subject' => 'Ciências']],
                'sala_copy_invitations' => [['id' => $invite, 'owner_id' => $owner, 'sender_email' => 'origem@example.test', 'recipient_email' => 'destino@example.test', 'kind' => 'class', 'resource_name' => '7 A', 'student_count' => 0, 'payload' => ['classroom' => ['name' => 'Cópia', 'grade' => '7', 'subject' => 'Ciências'], 'students' => []]]]], 'files' => []];
    }

    private function manifest(array $backup): string
    {
        $path = tempnam(sys_get_temp_dir(), 'provaai-migration-');
        $this->temporary[] = $path;
        file_put_contents($path, json_encode($backup));

        return $path;
    }

    public function test_import_dry_run_and_legacy_invitation_mapping(): void
    {
        Storage::fake('local');
        $backup = $this->backup();
        $path = $this->manifest($backup);
        $this->artisan('provaai:import-legacy', ['manifest' => $path])->assertSuccessful();
        $this->assertDatabaseCount('users', 0);
        $this->artisan('provaai:import-legacy', ['manifest' => $path, '--apply' => true])->assertSuccessful();
        $this->assertDatabaseHas('users', ['id' => $backup['users'][0]['id']]);
        $snapshot = json_decode(DB::table('sala_copy_invitations')->value('snapshot'), true);
        $this->assertSame('Cópia', $snapshot['class']['name']);
        $this->assertDatabaseCount('sala_classes', 1);
    }

    public function test_import_refuses_existing_accounts(): void
    {
        User::factory()->create();
        $path = $this->manifest($this->backup());
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('banco Laravel vazio');
        $this->artisan('provaai:import-legacy', ['manifest' => $path, '--apply' => true])->run();
    }

    public function test_import_rejects_cross_owner_relationship_before_writing(): void
    {
        $backup = $this->backup();
        $other = (string) Str::uuid();
        $backup['users'][] = ['id' => $other, 'email' => 'outro@example.test'];
        $backup['tables']['sala_students'] = [['id' => (string) Str::uuid(), 'user_id' => $other, 'class_id' => $backup['tables']['sala_classes'][0]['id'], 'name' => 'Aluno', 'code' => 'A001']];
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('proprietário correspondente');
        $this->artisan('provaai:import-legacy', ['manifest' => $this->manifest($backup)])->run();
    }

    public function test_export_only_reads_and_omits_tokens(): void
    {
        $dir = sys_get_temp_dir().'/provaai-backup-'.Str::uuid();
        config(['provaai.legacy_url' => 'https://example.supabase.co', 'provaai.legacy_key' => 'test-only']);
        $id = (string) Str::uuid();
        Http::preventStrayRequests();
        Http::fake([
            '*/auth/v1/admin/users*' => Http::response(['users' => [['id' => $id, 'email' => 'teste@example.test', 'created_at' => '2026-01-01', 'user_metadata' => [], 'secret_token' => 'never-export']]]),
            '*/rest/v1/*' => Http::response([]),
        ]);
        try {
            $this->artisan('provaai:export-supabase', ['directory' => $dir])->assertSuccessful();
            $bytes = file_get_contents($dir.'/manifest.json');
            $this->assertStringNotContainsString('never-export', $bytes);
            $this->assertCount(1, json_decode($bytes, true)['users']);
            Http::assertSentCount(8);
            Http::assertNotSent(fn ($request) => $request->method() !== 'GET');
        } finally {
            if (is_file($dir.'/manifest.json')) {
                unlink($dir.'/manifest.json');
            }if (is_dir($dir.'/files')) {
                rmdir($dir.'/files');
            }if (is_dir($dir)) {
                rmdir($dir);
            }
        }
    }
}
