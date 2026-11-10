<?php

namespace App\Models;

class CopyInvitation extends OwnedModel
{
    protected $table = 'sala_copy_invitations';

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'accepted_at' => 'datetime', 'revoked_at' => 'datetime', 'student_count' => 'integer'];
    }

    protected $hidden = ['snapshot'];
}
