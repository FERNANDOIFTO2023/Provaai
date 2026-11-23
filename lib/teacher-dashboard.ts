/* Painel / contrato e calendário. Datas civis evitam deslocamento de dia pelo fuso do navegador. */
export type DashboardDay = { date: string; exams: number; regular: number; recovery: number; tokens: number };
export type DashboardData = {
  month: string; period: string; from: string; to: string; timezone: string;
  summary: { exams: number; approved: number; drafts: number; empty_drafts: number; questions: number; regular: number; recovery: number };
  usage: { requests: number; measured_requests: number; unmeasured_requests: number; input_measured_requests: number; output_measured_requests: number; http_failures: number;
    input_tokens: number; output_tokens: number; total_tokens: number; duration_ms: number; average_seconds: number | null;
    first_recorded_at: string | null; stages: Record<string, number>; providers: Record<string, number> };
  daily: DashboardDay[]; classes: { name: string; exams: number }[]; active_classes: number; active_students: number;
};
export const dashboardToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const civilDate = (value: string) => new Date(`${value.length === 7 ? value + '-01' : value}T12:00:00Z`);
export const formatDay = (value: string) => civilDate(value).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
export const monthLabel = (value: string) => civilDate(value).toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
export function shiftMonth(month: string, offset: number) {
  const date = civilDate(month); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const first = civilDate(month);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { offset: (first.getUTCDay() + 6) % 7, dates: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`) };
}
// Faixas fixas tornam comparáveis as cores entre meses, sem depender do maior valor do mês atual.
export const activityLevel = (count: number) => count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
export function activityBars(days: DashboardDay[], period: string) {
  const groups = new Map<string, { label: string; regular: number; recovery: number }>();
  for (const day of days) {
    const n = Number(day.date.slice(8));
    const start = Math.floor((n - 1) / 7) * 7 + 1;
    const key = period === 'month' ? `${start}` : day.date.slice(0, 7);
    const label = period === 'month' ? `${start}–${Math.min(start + 6, days.length)}` : civilDate(day.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const group = groups.get(key) ?? { label, regular: 0, recovery: 0 };
    group.regular += day.regular; group.recovery += day.recovery; groups.set(key, group);
  }
  return [...groups.values()];
}

/** Demonstração identificada: não persiste métricas nem atribui consumo fictício a uma conta real. */
export function demoDashboard(month: string, period: string): DashboardData {
  const from = shiftMonth(month, period === 'quarter' ? -2 : period === 'year' ? -11 : 0) + '-01';
  const to = calendarDays(month).dates.at(-1)!;
  const daily: DashboardDay[] = [];
  for (const date = civilDate(from); date.toISOString().slice(0, 10) <= to; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10), n = date.getUTCDate();
    const exams = day > dashboardToday() || date.getUTCDay() === 0 ? 0 : [0, 2, 4, 1, 8, 3, 12][n % 7];
    const recovery = Math.floor(exams / 3);
    daily.push({ date: day, exams, regular: exams - recovery, recovery, tokens: exams * 1400 });
  }
  const exams = daily.reduce((s, d) => s + d.exams, 0), recovery = daily.reduce((s, d) => s + d.recovery, 0);
  return { month, period, from, to, timezone: 'America/Sao_Paulo', daily, active_classes: 3, active_students: 48,
    summary: { exams, recovery, regular: exams - recovery, approved: Math.floor(exams * .8), drafts: exams - Math.floor(exams * .8), empty_drafts: 2, questions: exams * 5 },
    usage: { requests: exams * 2, measured_requests: exams * 2, input_measured_requests: exams * 2, output_measured_requests: exams * 2, unmeasured_requests: 0, http_failures: 0,
      input_tokens: exams * 950, output_tokens: exams * 450, total_tokens: exams * 1400, duration_ms: exams * 18000, average_seconds: 9,
      first_recorded_at: from + 'T12:00:00Z', stages: { generation: exams * 1000, review: exams * 400 }, providers: { gemini: exams * 1400 } },
    classes: [{ name: '7º ano A', exams: Math.floor(exams * .5) }, { name: '8º ano B', exams: Math.floor(exams * .3) }, { name: '9º ano A', exams: exams - Math.floor(exams * .5) - Math.floor(exams * .3) }] };
}
