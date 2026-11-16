<?php

/*
 * Persistência / convites de cópia
 * Mantém o retrato dos dados enviados e as datas de aceite ou cancelamento. O snapshot fica oculto
 * na serialização; acesso ao convite considera owner_id e e-mail do destinatário.
 */


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
