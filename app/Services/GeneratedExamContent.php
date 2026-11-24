<?php

/*
 * Serviços / contrato da resposta da IA
 * Define o esquema solicitado ao provedor e resolve indicações explícitas de alternativas. Não
 * inventa uma resposta ausente nem corrige contradições por aproximação.
 */


namespace App\Services;

class GeneratedExamContent
{
    /** Identifica só alternativas repetidas em questões com estrutura suficiente para substituição. */
    public function repeatedOptionPositions(array $content): array
    {
        if (!is_array($content['questions'] ?? null) || !array_is_list($content['questions'])) return [];
        $positions = [];
        foreach ($content['questions'] as $position => $question) {
            if (!is_array($question) || ($question['type'] ?? null) !== 'objective') continue;
            $options = $question['options'] ?? null;
            if (!is_array($options) || !array_is_list($options) || count($options) !== 4
                || count(array_filter($options, 'is_string')) !== 4) continue;
            if (count(array_unique(array_map(self::optionKey(...), $options))) !== 4) $positions[] = $position;
        }
        return $positions;
    }

    /** Monta o esquema JSON conforme total e distribuição; objetivas indicam a resposta por índice de zero a três. */
    public function schema(int $count, int $objective): array
    {
        $common = [
            'statement' => ['type' => 'string'],
            'objective' => ['type' => 'string'],
            'points' => ['type' => 'number', 'minimum' => 0.1, 'maximum' => 100],
        ];
        $variants = [];
        if ($objective > 0) {
            $variants[] = ['type' => 'object', 'additionalProperties' => false,
                'required' => ['statement', 'type', 'options', 'answerIndex', 'objective', 'points'],
                'properties' => [...$common,
                    'type' => ['type' => 'string', 'enum' => ['objective']],
                    'options' => ['type' => 'array', 'items' => ['type' => 'string'], 'minItems' => 4, 'maxItems' => 4],
                    'answerIndex' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3],
                ]];
        }
        if ($objective < $count) {
            $variants[] = ['type' => 'object', 'additionalProperties' => false,
                'required' => ['statement', 'type', 'options', 'answer', 'objective', 'points'],
                'properties' => [...$common,
                    'type' => ['type' => 'string', 'enum' => ['essay']],
                    'options' => ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 0],
                    'answer' => ['type' => 'string'],
                ]];
        }

        return ['type' => 'object', 'additionalProperties' => false, 'required' => ['instructions', 'questions'],
            'properties' => ['instructions' => ['type' => 'string'],
                'questions' => ['type' => 'array', 'minItems' => $count, 'maxItems' => $count,
                    'items' => count($variants) === 1 ? $variants[0] : ['anyOf' => $variants]],
            ]];
    }

    /** Resolve apenas uma seleção explícita de alternativa; nunca inventa resposta nem opção. */
    public function prepare(array $content): array
    {
        if (! is_array($content['questions'] ?? null) || ! array_is_list($content['questions'])) {
            return $content;
        }
        foreach ($content['questions'] as $number => &$question) {
            if (! is_array($question) || ($question['type'] ?? null) !== 'objective') {
                continue;
            }
            $options = $question['options'] ?? null;
            if (! is_array($options) || ! array_is_list($options) || count($options) !== 4 || count(array_filter($options, 'is_string')) !== 4) {
                continue;
            }
            $answer = $question['answer'] ?? '';
            $hasIndex = array_key_exists('answerIndex', $question);
            $index = $question['answerIndex'] ?? null;
            if ($hasIndex && (! is_int($index) || $index < 0 || $index > 3)) {
                app(ExamValidator::class)->fail('A questão '.($number + 1).' veio com uma indicação inválida da alternativa correta. Tente gerar novamente.');
            }
            $matches = [];
            if (is_string($answer) && trim($answer) !== '') {
                foreach ($options as $position => $option) {
                    if (self::optionKey($answer) === self::optionKey($option)) {
                        $matches[] = $position;
                    }
                }
                // Alguns provedores devolvem uma letra em vez de repetir o texto da opção.
                // Uma opção cujo texto literal seja essa letra tem precedência.
                if ($matches === [] && preg_match('/^(?:alternativa\s+)?([A-D])(?:[).])?$/iu', trim($answer), $match)) {
                    $matches[] = ord(strtoupper($match[1])) - ord('A');
                }
                if ($hasIndex && $matches !== [$index]) {
                    app(ExamValidator::class)->fail('O gabarito da questão '.($number + 1).' veio com duas indicações diferentes. Tente gerar novamente.');
                }
            } elseif (! is_string($answer)) {
                continue;
            }
            if ($hasIndex || count($matches) === 1) {
                $question['answer'] = $options[$hasIndex ? $index : $matches[0]];
            }
            unset($question['answerIndex']);
        }
        unset($question);

        return $content;
    }

    /** Normaliza apresentação sem fundir símbolos matemáticos que possam ter significados diferentes. */
    public static function optionKey(string $text): string
    {
        // NFC preserva símbolos e maiúsculas; NFKC ou conversão para minúsculas podem confundir x/X e expoentes.
        $text = trim(\Normalizer::normalize($text, \Normalizer::FORM_C));
        $math = strpbrk($text, '\\+-*/=^_{}<>') !== false || preg_match('/^[\p{L}]$|[\p{Sm}\p{No}]/u', $text);
        foreach ([['\\(', '\\)'], ['\\[', '\\]'], ['$$', '$$']] as [$open, $close]) {
            if (str_starts_with($text, $open) && str_ends_with($text, $close)) {
                $text = trim(substr($text, strlen($open), -strlen($close)));
                $math = true;
                break;
            }
        }

        $text = preg_replace('/\s+/u', ' ', $text);

        return $math ? $text : mb_strtolower($text);
    }
}
