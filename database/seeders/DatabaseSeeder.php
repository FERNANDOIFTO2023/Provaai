<?php

/*
 * Banco / dados iniciais
 * Ponto de entrada do preenchimento inicial do Laravel. Antes de habilitar novos registros aqui,
 * diferencie dados de desenvolvimento de dados necessários em produção.
 */


namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Preenche os dados iniciais configurados para a aplicação.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
