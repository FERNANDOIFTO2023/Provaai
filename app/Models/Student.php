<?php

namespace App\Models;

class Student extends OwnedModel
{
    protected $table = 'sala_students';

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }
}
