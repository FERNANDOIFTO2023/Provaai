<?php

namespace App\Models;

class Exam extends OwnedModel
{
    protected $table = 'sala_exams';

    protected function casts(): array
    {
        return ['content' => 'array', 'profile_snapshot' => 'array', 'question_count' => 'integer'];
    }
}
