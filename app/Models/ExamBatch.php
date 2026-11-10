<?php

namespace App\Models;

class ExamBatch extends OwnedModel
{
    protected $table = 'sala_exam_batches';

    protected function casts(): array
    {
        return ['exam_ids' => 'array', 'lease_until' => 'datetime', 'completed' => 'integer', 'failed' => 'integer'];
    }

    protected $primaryKey = 'user_id';

    protected $keyType = 'string';

    public $incrementing = false;

    public function uniqueIds(): array
    {
        return [];
    }
}
