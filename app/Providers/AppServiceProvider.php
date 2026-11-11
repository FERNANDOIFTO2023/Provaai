<?php

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
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::createAssetPathsUsing(fn (string $path) => '/'.ltrim($path, '/'));
        foreach ([ClassRoom::class, Student::class, Exam::class, ExamTemplate::class] as $model) {
            Gate::policy($model, OwnedPolicy::class);
        }
    }
}
