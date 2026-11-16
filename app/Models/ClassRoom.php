<?php

/*
 * Persistência / turmas
 * Mapeia a turma e converte recorte, preferência de modelo e datas de arquivamento. As regras de
 * exclusão e reativação ficam nas ações de negócio, não nos casts.
 */


namespace App\Models;

class ClassRoom extends OwnedModel
{
    protected $table = 'sala_classes';

    protected function casts(): array
    {
        return ['banner_crop' => 'array', 'use_provaai_template' => 'boolean', 'archived_at' => 'datetime', 'deletion_due_at' => 'datetime'];
    }
}
