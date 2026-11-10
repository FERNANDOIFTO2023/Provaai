<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ExamValidator
{
    public function validate(array $content, ?int $count = null, ?int $objective = null): array
    {
        Validator::make($content, [
            'instructions' => 'present|nullable|string|max:2000', 'questions' => 'required|array|min:1|max:30',
            'questions.*.statement' => 'required|string|min:5|max:3000', 'questions.*.type' => 'required|in:objective,essay',
            'questions.*.options' => 'present|array|max:4', 'questions.*.options.*' => 'required|string|max:500',
            'questions.*.answer' => 'required|string|max:3000', 'questions.*.objective' => 'required|string|max:500',
            'questions.*.points' => 'required|numeric|min:0.1|max:100',
        ])->validate();
        $questions = $content['questions'];
        $seen = [];
        $actual = 0;
        foreach ($questions as $q) {
            $key = $this->normalize($q['statement']);
            if (isset($seen[$key])) {
                $this->fail('Foram detectadas questões repetidas.');
            }
            $seen[$key] = true;
            if ($q['type'] === 'objective') {
                $actual++;
                if (count($q['options']) !== 4 || count(array_unique(array_map($this->normalize(...), $q['options']))) !== 4 || ! in_array($q['answer'], $q['options'], true)) {
                    $this->fail('Questões objetivas precisam de quatro alternativas distintas e resposta igual à correta.');
                }
            } elseif (count($q['options'])) {
                $this->fail('Questões discursivas não têm alternativas.');
            }
        }
        if (($count !== null && count($questions) !== $count) || ($objective !== null && $actual !== $objective)) {
            $this->fail('A IA não respeitou a quantidade e distribuição solicitadas.');
        }

        return $content;
    }

    public function normalize(string $text): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim(\Normalizer::normalize($text, \Normalizer::FORM_KC))));
    }

    public function fail(string $message): never
    {
        throw ValidationException::withMessages(['content' => $message]);
    }
}
