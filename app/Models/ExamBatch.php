<?php

/*
 * Persistência / progresso do lote
 * Mantém um registro por professor, usando user_id como chave primária. batch_id distingue
 * execuções sucessivas; lease e lease_until identificam a reserva de uma etapa.
 */


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

    /** Evita gerar UUID para user_id: o lote reutiliza a identidade do professor como chave. */
    public function uniqueIds(): array
    {
        return [];
    }
}
