<?php

/*
 * Persistência / alunos
 * Mapeia o aluno vinculado à turma e converte sua data de arquivamento. O código é único dentro da
 * turma; a numeração é atribuída no backend.
 */


namespace App\Models;

class Student extends OwnedModel
{
    protected $table = 'sala_students';

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }
}
