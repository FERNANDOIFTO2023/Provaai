<?php

namespace App\Models;

class ExamTemplate extends OwnedModel
{
    protected $table = 'sala_templates';

    protected function casts(): array
    {
        return ['pdf_header_ratio' => 'float'];
    }
}
