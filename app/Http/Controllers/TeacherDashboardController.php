<?php

namespace App\Http\Controllers;

use App\Models\{ClassRoom, Exam, Student};
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Agrega somente registros do professor autenticado. Nenhum nome de aluno ou texto de prova é exposto. */
class TeacherDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $v = $request->validate(['month' => 'required|date_format:Y-m', 'period' => 'required|in:month,quarter,year']);
        $uid = $request->user()->id;
        $zone = 'America/Sao_Paulo';
        $month = CarbonImmutable::createFromFormat('!Y-m', $v['month'], $zone);
        abort_if($month->year < 2000 || $month->greaterThan(now($zone)->startOfMonth()), 422, 'Escolha um mês entre janeiro de 2000 e o mês atual.');
        $start = $month->subMonths(match ($v['period']) { 'quarter' => 2, 'year' => 11, default => 0 });
        $end = $month->addMonth();
        $from = $start->utc(); $until = $end->utc();
        $daily = [];
        for ($day = $start; $day->lessThan($end); $day = $day->addDay()) {
            $daily[$day->toDateString()] = ['date' => $day->toDateString(), 'exams' => 0, 'regular' => 0, 'recovery' => 0, 'tokens' => 0];
        }
        $summary = ['exams' => 0, 'approved' => 0, 'drafts' => 0, 'empty_drafts' => 0, 'questions' => 0, 'regular' => 0, 'recovery' => 0];
        $byClass = [];
        // Cursor evita o limite de 1.000 registros da listagem e não carrega anexos no painel.
        foreach (Exam::ownedBy($uid)->where('created_at', '>=', $from)->where('created_at', '<', $until)
            ->select(['id', 'class_id', 'content', 'purpose', 'status', 'created_at'])->cursor() as $exam) {
            $questions = $exam->content['questions'] ?? [];
            if (!$questions) { $summary['empty_drafts']++; continue; }
            $day = $exam->created_at->setTimezone($zone)->toDateString();
            $purpose = $exam->purpose === 'recovery' ? 'recovery' : 'regular';
            $daily[$day]['exams']++; $daily[$day][$purpose]++;
            $summary['exams']++; $summary[$purpose]++;
            $summary[$exam->status === 'approved' ? 'approved' : 'drafts']++;
            $summary['questions'] += count($questions);
            $byClass[$exam->class_id] = ($byClass[$exam->class_id] ?? 0) + 1;
        }
        $usage = ['requests' => 0, 'measured_requests' => 0, 'unmeasured_requests' => 0, 'input_measured_requests' => 0, 'output_measured_requests' => 0, 'http_failures' => 0,
            'input_tokens' => 0, 'output_tokens' => 0, 'total_tokens' => 0, 'duration_ms' => 0, 'stages' => [], 'providers' => []];
        foreach (DB::table('ai_usage_events')->where('user_id', $uid)->where('created_at', '>=', $from)->where('created_at', '<', $until)->orderBy('id')->cursor() as $event) {
            $usage['requests']++; $usage['duration_ms'] += $event->duration_ms;
            $usage[$event->total_tokens === null ? 'unmeasured_requests' : 'measured_requests']++;
            if ($event->input_tokens !== null) $usage['input_measured_requests']++;
            if ($event->output_tokens !== null) $usage['output_measured_requests']++;
            if ($event->http_status === null || $event->http_status >= 400) $usage['http_failures']++;
            foreach (['input_tokens', 'output_tokens', 'total_tokens'] as $field) $usage[$field] += $event->$field ?? 0;
            $day = CarbonImmutable::parse($event->created_at, 'UTC')->setTimezone($zone)->toDateString();
            $daily[$day]['tokens'] += $event->total_tokens ?? 0;
            $usage['stages'][$event->stage] = ($usage['stages'][$event->stage] ?? 0) + ($event->total_tokens ?? 0);
            $usage['providers'][$event->provider] = ($usage['providers'][$event->provider] ?? 0) + ($event->total_tokens ?? 0);
        }
        $usage['average_seconds'] = $usage['requests'] ? round($usage['duration_ms'] / $usage['requests'] / 1000, 1) : null;
        $first = DB::table('ai_usage_events')->where('user_id', $uid)->min('created_at');
        $usage['first_recorded_at'] = $first ? CarbonImmutable::parse($first, 'UTC')->setTimezone($zone)->toIso8601String() : null;
        $rooms = ClassRoom::ownedBy($uid)->whereIn('id', array_keys($byClass))->pluck('name', 'id');
        arsort($byClass);
        $classes = [];
        foreach (array_slice($byClass, 0, 5, true) as $id => $count) $classes[] = ['name' => $rooms[$id] ?? 'Turma', 'exams' => $count];
        return response()->json([
            'month' => $v['month'], 'period' => $v['period'], 'from' => $start->toDateString(), 'to' => $end->subDay()->toDateString(), 'timezone' => $zone,
            'summary' => $summary, 'usage' => $usage, 'daily' => array_values($daily), 'classes' => $classes,
            'active_classes' => ClassRoom::ownedBy($uid)->whereNull('archived_at')->count(),
            'active_students' => Student::ownedBy($uid)->whereNull('archived_at')->whereIn('class_id', ClassRoom::ownedBy($uid)->whereNull('archived_at')->select('id'))->count(),
        ])->header('Cache-Control', 'private, no-store');
    }
}
