<?php

/*
 * Autorização / propriedade
 * Autoriza leitura e mutações somente quando a conta corresponde ao proprietário do registro. É uma
 * verificação complementar aos escopos de consulta dos controladores.
 */


namespace App\Policies;

use App\Models\OwnedModel;
use App\Models\User;

class OwnedPolicy
{
    public function view(User $user, OwnedModel $record): bool
    {
        return $user->id === $record->user_id;
    }

    public function update(User $user, OwnedModel $record): bool
    {
        return $this->view($user, $record);
    }

    public function delete(User $user, OwnedModel $record): bool
    {
        return $this->view($user, $record);
    }
}
