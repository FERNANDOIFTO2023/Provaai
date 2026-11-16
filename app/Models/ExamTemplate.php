<?php

/*
 * Persistência / modelos de prova
 * Mapeia o arquivo privado e seus metadados de processamento. A proporção do cabeçalho é armazenada
 * como número para o recorte do PDF.
 */


namespace App\Models;

class ExamTemplate extends OwnedModel
{
    protected $table = 'sala_templates';

    protected function casts(): array
    {
        return ['pdf_header_ratio' => 'float'];
    }
}
