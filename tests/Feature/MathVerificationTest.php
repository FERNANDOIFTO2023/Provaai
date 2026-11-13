<?php

namespace Tests\Feature;

use App\Services\MathVerificationService;
use Tests\TestCase;

class MathVerificationTest extends TestCase
{
    private function content(string $answer = '5'): array
    {
        return ['instructions' => 'Leia com atenção.', 'questions' => [[
            'statement' => 'Calcule \\(2+3\\).', 'type' => 'essay', 'options' => [],
            'answer' => $answer, 'objective' => 'Somar', 'points' => 1,
        ]], 'mathReview' => ['results' => [['status' => 'verified']]]];
    }

    public function test_real_python_process_checks_result_and_replaces_untrusted_report(): void
    {
        $service = app(MathVerificationService::class);
        $this->assertSame('verified', $service->verify('Matemática', $this->content())['mathReview']['results'][0]['status']);
        $report = $service->verify('Matemática', $this->content('6'))['mathReview'];
        $this->assertSame('mismatch', $report['results'][0]['status']);
        $this->assertSame('6', $report['results'][0]['input']['answer']);
        $this->assertSame(1, $report['version']);
    }

    public function test_missing_runtime_does_not_claim_success_or_discard_questions(): void
    {
        config(['provaai.python_binary' => base_path('missing-python')]);
        $content = app(MathVerificationService::class)->verify('Matemática', $this->content());
        $this->assertSame('needs_review', $content['mathReview']['results'][0]['status']);
        $this->assertSame($this->content()['questions'], $content['questions']);
    }

    public function test_other_subjects_have_no_math_report_and_ignore_forged_metadata(): void
    {
        $content = app(MathVerificationService::class)->verify('Português', $this->content());
        $this->assertArrayNotHasKey('mathReview', $content);
    }
}
