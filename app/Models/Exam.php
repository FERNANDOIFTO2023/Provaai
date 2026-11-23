<?php

/*
 * Persistência / provas
 * Converte o conteúdo e o retrato do perfil do aluno para estruturas PHP. O snapshot preserva os
 * dados usados na preparação mesmo quando o cadastro do aluno muda.
 */


namespace App\Models;

class Exam extends OwnedModel
{
    protected $table = 'sala_exams';

    protected function casts(): array
    {
        return ['content' => 'array', 'profile_snapshot' => 'array', 'source_snapshot' => 'array', 'external_research' => 'array', 'question_count' => 'integer'];
    }

    // O contexto completo fica no servidor; a revisão recebe somente os dados da pesquisa e a prova.
    protected $hidden = ['source_snapshot'];
}
