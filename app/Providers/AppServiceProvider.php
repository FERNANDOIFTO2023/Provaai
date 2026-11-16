<?php

/*
 * Inicialização / serviços e políticas
 * Registra as políticas de propriedade dos modelos e a resolução dos caminhos de assets. É
 * executado no bootstrap do Laravel antes do atendimento das requisições.
 */


namespace App\Providers;

use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Policies\OwnedPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Ponto de registro de serviços no contêiner; atualmente não há vinculações adicionais.
     */
    public function register(): void
    {
        //
    }

    /**
     * Configura caminhos de assets e políticas após registrar os serviços.
     */
    public function boot(): void
    {
        Vite::createAssetPathsUsing(fn (string $path) => '/'.ltrim($path, '/'));
        foreach ([ClassRoom::class, Student::class, Exam::class, ExamTemplate::class] as $model) {
            Gate::policy($model, OwnedPolicy::class);
        }
    }
}
