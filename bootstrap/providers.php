<?php

/*
 * Inicialização / provedores
 * Lista os provedores da aplicação carregados pelo Laravel. O registro de políticas e integração
 * com assets está no AppServiceProvider.
 */


use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
];
