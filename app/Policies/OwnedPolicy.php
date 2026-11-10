<?php

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
