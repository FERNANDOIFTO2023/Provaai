<?php

namespace App\Models;

/** Material privado de estudo; separado dos modelos de diagramação das provas. */
class ClassMaterial extends OwnedModel
{
    protected $table = 'sala_class_materials';
    protected $hidden = ['path'];
}
