<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use OpenSpout\Common\Entity\Cell\FormulaCell;
use OpenSpout\Reader\XLSX\Options;
use OpenSpout\Reader\XLSX\Reader;
use ZipArchive;

/** Leitura restrita ao modelo de alunos. Não executa fórmulas nem armazena o arquivo enviado. */
class StudentSpreadsheet
{
    public const HEADERS = ['Nome do aluno', 'Nível atual', 'Dificuldades e objetivos de aprendizagem', 'Critérios específicos para as provas'];
    public const LEVELS = ['Em desenvolvimento', 'Intermediário', 'Avançado'];

    public static function nameKey(string $name): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($name)));
    }

    /** Limita o ZIP antes de o leitor expandi-lo, inclusive arquivos auxiliares não utilizados. */
    private function checkArchive(string $path): void
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            $this->invalid('Envie uma planilha Excel válida no formato .xlsx.');
        }
        try {
            $total = 0;
            if ($zip->numFiles > 1000) {
                $this->invalid('A planilha é muito complexa. Copie os alunos para um modelo novo.');
            }
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = $zip->statIndex($i);
                $total += $entry['size'];
                if ($total > 20 * 1024 * 1024 || preg_match('~(^/|(^|/)\.\.(/|$)|\\\\|vbaProject\.bin$)~i', $entry['name'])) {
                    $this->invalid('O arquivo excede os limites ou contém recursos não permitidos. Use o modelo Excel.');
                }
                if (preg_match('/\.(xml|rels)$/i', $entry['name'])) {
                    $xml = $zip->getFromIndex($i);
                    if ($xml === false || preg_match('/<!\s*(DOCTYPE|ENTITY)\b/i', str_replace("\0", '', $xml))) {
                        $this->invalid('A planilha contém XML não permitido. Use um modelo novo.');
                    }
                }
            }
        } finally {
            $zip->close();
        }
    }

    /** Retorna os dados normalizados e os erros com a linha original, sem gravar alunos. */
    public function read(string $path): array
    {
        $this->checkArchive($path);
        $options = new Options;
        // Preservar linhas permite informar o mesmo número visto no Excel, inclusive após linhas vazias.
        $options->SHOULD_PRESERVE_EMPTY_ROWS = true;
        $reader = new Reader($options);
        $students = $errors = $seen = [];
        $found = false;
        $fileError = null;
        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($sheet->getName() !== 'Alunos') {
                    continue;
                }
                $found = true;
                foreach ($sheet->getRowIterator() as $line => $row) {
                    if ($line > 501) {
                        $fileError = 'Use até 500 alunos, nas linhas 2 a 501 da aba Alunos.';
                        break;
                    }
                    $values = [];
                    foreach ($row->getCells() as $index => $cell) {
                        $value = $cell->getValue();
                        if ($cell instanceof FormulaCell || (!is_string($value) && $value !== null)) {
                            $errors[] = ['line' => $line, 'message' => 'Use somente texto, sem fórmulas, datas ou números isolados.'];
                            $value = '';
                        }
                        $values[$index] = trim($value ?? '');
                    }
                    if ($line === 1) {
                        if (array_slice(array_pad($values, 4, ''), 0, 4) !== self::HEADERS || array_filter(array_slice($values, 4))) {
                            $fileError = 'Os cabeçalhos foram alterados. Baixe o modelo e mantenha as quatro colunas, sem código.';
                            break;
                        }
                        continue;
                    }
                    if (!array_filter($values, fn ($value) => $value !== '')) {
                        continue;
                    }
                    if (array_filter(array_slice($values, 4), fn ($value) => $value !== '')) {
                        $errors[] = ['line' => $line, 'message' => 'Preencha somente as quatro colunas do modelo. O código é criado pelo site.'];
                    }
                    $data = [
                        'name' => $values[0] ?? '',
                        'level' => ($values[1] ?? '') ?: 'Intermediário',
                        'difficulties' => $values[2] ?? '',
                        'criteria' => $values[3] ?? '',
                    ];
                    $validator = Validator::make($data, [
                        'name' => 'required|string|min:2|max:100',
                        'level' => ['required', \Illuminate\Validation\Rule::in(self::LEVELS)],
                        'difficulties' => 'string|max:2000',
                        'criteria' => 'string|max:2000',
                    ], [
                        'name.required' => 'Informe o nome do aluno.',
                        'name.min' => 'O nome precisa ter pelo menos 2 caracteres.',
                        'name.max' => 'O nome deve ter até 100 caracteres.',
                        'level.in' => 'Nível inválido. Use Em desenvolvimento, Intermediário ou Avançado.',
                        'difficulties.max' => 'Dificuldades e objetivos devem ter até 2.000 caracteres.',
                        'criteria.max' => 'Os critérios devem ter até 2.000 caracteres.',
                    ]);
                    foreach ($validator->errors()->all() as $message) {
                        $errors[] = ['line' => $line, 'message' => $message];
                    }
                    $key = self::nameKey($data['name']);
                    if (isset($seen[$key])) {
                        $errors[] = ['line' => $line, 'message' => "Nome repetido na linha {$seen[$key]}. Confira os homônimos e cadastre-os manualmente, se necessário."];
                    }
                    $seen[$key] = $line;
                    $students[] = ['line' => $line, ...$data];
                }
                break;
            }
        } catch (\Throwable $e) {
            // Não revela caminhos temporários ou conteúdo pessoal em mensagens de erro.
            $fileError = 'Não foi possível ler o arquivo. Salve uma cópia em .xlsx usando o modelo e tente novamente.';
            unset($e);
        } finally {
            $reader->close();
            // Libera também o iterador XML antes de lançar erro, evitando bloquear o temporário no Windows.
            unset($sheet, $reader);
            gc_collect_cycles();
        }
        if ($fileError) {
            $this->invalid($fileError);
        }
        if (!$found) {
            $this->invalid('A aba Alunos não foi encontrada. Use o modelo disponibilizado pelo site.');
        }
        if (!$students && !$errors) {
            $this->invalid('Preencha pelo menos um aluno na aba Alunos antes de enviar.');
        }

        return ['students' => $students, 'errors' => $errors];
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['file' => $message]);
    }
}
