<?php

namespace App\Services;

use App\Models\ClassMaterial;
use App\Models\ClassRoom;

class ClassSources
{
    /** O lote lê os textos prontos uma vez e congela as fontes. Nunca reutiliza questões. */
    public function snapshot(string $uid, string $classId): ?array
    {
        $room = ClassRoom::ownedBy($uid)->findOrFail($classId);
        $materials = ClassMaterial::ownedBy($uid)->where('class_id', $classId)->orderBy('created_at')->get();
        if ($materials->isEmpty()) return null;
        return ['allow_external' => $room->allow_external_sources, 'materials' => $materials->map(fn ($m) => [
            'id' => $m->id, 'name' => $m->filename, 'text' => $m->extracted_text,
        ])->all()];
    }
}
