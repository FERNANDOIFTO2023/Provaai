<?php

namespace Tests\Feature;

use App\Services\ExamValidator;
use App\Services\GeneratedExamContent;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GeneratedExamContentTest extends TestCase
{
    private function content(array $changes = []): array
    {
        return ['instructions' => 'Responda.', 'questions' => [array_replace([
            'statement' => 'Calcule \\(2+3\\).', 'type' => 'objective',
            'options' => ['\\(4\\)', '\\(5\\)', '\\(6\\)', '\\(7\\)'],
            'answer' => '5', 'objective' => 'Somar', 'points' => 10,
        ], $changes)]];
    }

    public function test_known_format_variations_resolve_to_the_original_option(): void
    {
        foreach (['5', '  \\(5\\)  ', '\\[5\\]', '$$5$$', 'B', 'Alternativa B', 'B)'] as $answer) {
            $content = app(GeneratedExamContent::class)->prepare($this->content(['answer' => $answer]));
            $this->assertSame('\\(5\\)', $content['questions'][0]['answer']);
            app(ExamValidator::class)->validate($content, 1, 1);
        }
    }

    public function test_index_selects_exact_option_without_a_second_copy_of_the_formula(): void
    {
        $raw = $this->content(['answerIndex' => 1]);
        unset($raw['questions'][0]['answer']);
        $content = app(GeneratedExamContent::class)->prepare($raw);
        $this->assertSame('\\(5\\)', $content['questions'][0]['answer']);
        $this->assertArrayNotHasKey('answerIndex', $content['questions'][0]);
        app(ExamValidator::class)->validate($content, 1, 1);
    }

    public function test_literal_letter_value_is_not_mistaken_for_an_option_label(): void
    {
        $raw = $this->content(['options' => ['\\(X\\)', '\\(A\\)', '\\(B\\)', '\\(a\\)'], 'answer' => 'A']);
        $content = app(GeneratedExamContent::class)->prepare($raw);
        $this->assertSame('\\(A\\)', $content['questions'][0]['answer']);
        app(ExamValidator::class)->validate($content, 1, 1);
    }

    public function test_invalid_or_ambiguous_answers_are_never_guessed(): void
    {
        $cases = [
            ['answerIndex' => 4], ['answerIndex' => '1'], ['answerIndex' => 0],
            ['answer' => 'Resultado: 5 porque somamos dois e três.'],
            ['options' => ['5', '\\(5\\)', '6', '7']],
            ['options' => ['Azul', 'azul', 'Verde', 'Preto'], 'answer' => 'Azul'],
            ['options' => ['4', '5', '6']],
        ];
        foreach ($cases as $changes) {
            try {
                $content = app(GeneratedExamContent::class)->prepare($this->content($changes));
                app(ExamValidator::class)->validate($content, 1, 1);
                $this->fail('Invalid question was accepted: '.json_encode($changes));
            } catch (ValidationException $error) {
                $this->assertNotEmpty($error->errors());
            }
        }
    }

    public function test_mathematical_case_and_superscripts_remain_distinct(): void
    {
        $content = $this->content(['options' => ['\\(x\\)', '\\(X\\)', 'x²', 'x2'], 'answer' => 'x²']);
        app(ExamValidator::class)->validate($content, 1, 1);
        $this->assertNotSame(GeneratedExamContent::optionKey('x²'), GeneratedExamContent::optionKey('x2'));
    }

    public function test_schema_limits_count_and_distinguishes_objective_and_essay_contracts(): void
    {
        $schema = app(GeneratedExamContent::class)->schema(5, 3);
        $questions = $schema['properties']['questions'];
        $this->assertSame(5, $questions['minItems']);
        $this->assertSame(5, $questions['maxItems']);
        [$objective, $essay] = $questions['items']['anyOf'];
        $this->assertSame(4, $objective['properties']['options']['minItems']);
        $this->assertSame(4, $objective['properties']['options']['maxItems']);
        $this->assertContains('answerIndex', $objective['required']);
        $this->assertSame(0, $essay['properties']['options']['maxItems']);
        $this->assertContains('answer', $essay['required']);
    }
}
