import test from 'node:test';
import assert from 'node:assert/strict';
import { activityBars, activityLevel, calendarDays, shiftMonth, demoDashboard } from '../lib/teacher-dashboard.ts';

test('calendário usa segunda-feira, anos bissextos e virada de ano sem deslocar o dia', () => {
  assert.equal(calendarDays('2024-02').dates.length, 29);
  assert.equal(calendarDays('2026-02').dates.length, 28);
  assert.equal(calendarDays('2026-11').offset, 6);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});
test('cores mantêm faixas fixas entre meses e o agrupamento preserva todas as provas', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 10, 11, 100].map(activityLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  const data = demoDashboard('2024-02', 'month');
  const bars = activityBars(data.daily, 'month');
  assert.equal(bars.at(-1)?.label, '29–29');
  assert.equal(bars.reduce((n, b) => n + b.regular + b.recovery, 0), data.summary.exams);
  assert.equal(activityBars(demoDashboard('2026-01', 'quarter').daily, 'quarter').length, 3);
  assert.equal(activityBars(demoDashboard('2026-01', 'year').daily, 'year').length, 12);
});
