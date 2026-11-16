<?php

/*
 * Persistência / conta do professor
 * Fornece a identidade autenticável usada pela sessão Laravel e pelos registros da conta. Os
 * atributos sensíveis ficam ocultos na serialização e a senha, quando definida, recebe hash.
 */


namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'email_verified_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, \Illuminate\Database\Eloquent\Concerns\HasUuids, Notifiable;

    /**
     * Define as conversões dos atributos ao ler e gravar o modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
