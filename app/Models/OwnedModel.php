<?php

/*
 * Persistência / propriedade dos registros
 * Compartilha UUIDs e proteção dos identificadores no preenchimento em massa. ownedBy é um escopo
 * explícito: consultas precisam chamá-lo, pois não há filtro global automático por professor.
 */


namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

abstract class OwnedModel extends Model
{
    use HasUuids;

    protected $guarded = ['id', 'user_id'];

    /** Acrescenta o filtro de proprietário à consulta; o identificador deve vir da sessão autenticada. */
    public function scopeOwnedBy(Builder $query, string $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}
