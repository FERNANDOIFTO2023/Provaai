<?php

// Render the actual production views through an in-memory mail transport.
// This never sends mail and only uses a fictitious code and recipient.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['mail.default' => 'array']);
$sent = Illuminate\Support\Facades\Mail::mailer('array')->to('preview@example.test')->send(new App\Mail\LoginCode('482619'));
$email = $sent->getOriginalMessage();
$html = $email->getHtmlBody();
foreach ($email->getAttachments() as $image) {
    $file = $image->getMediaSubtype() === 'gif' ? 'bloub-login.gif' : 'bloub-login.png';
    $html = str_replace(['cid:'.$image->getName(), 'cid:'.$image->getContentId()], '../../public/email/'.$file, $html);
}
file_put_contents(__DIR__.'/preview.html', $html);
file_put_contents(__DIR__.'/preview.txt', $email->getTextBody());
echo "Rendered docs/email/preview.html and preview.txt with a fictitious code. No email sent.\n";
