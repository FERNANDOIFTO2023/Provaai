<?php

// Render the production views in memory with a fictitious code and recipient.
// No email is delivered and no login code is stored.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['mail.default' => 'array']);
$sent = Illuminate\Support\Facades\Mail::mailer('array')->to('preview@example.test')->send(new App\Mail\LoginCode('482619'));
$email = $sent->getOriginalMessage();
file_put_contents(__DIR__.'/preview.html', $email->getHtmlBody());
file_put_contents(__DIR__.'/preview.txt', $email->getTextBody());
echo "Rendered docs/email/preview.html and preview.txt with a fictitious code. No email sent.\n";
