import test from 'node:test';
import assert from 'node:assert/strict';
import { deletionDate, classExpired, filterStudents } from '../lib/classroom.ts';
import { demoData } from '../lib/model.ts';

test('one calendar year includes leap-day boundaries and expires at the deadline', () => {
  assert.equal(deletionDate('2024-02-29T10:30:00.000Z'), '2025-02-28T10:30:00.000Z');
  assert.equal(deletionDate('2026-11-06T12:00:00.000Z'), '2027-11-06T12:00:00.000Z');
  const room = { ...demoData().classes[0], archived_at: '2026-11-06T12:00:00Z', deletion_due_at: '2027-11-06T12:00:00Z' };
  assert.equal(classExpired(room, Date.parse('2027-11-06T11:59:59Z')), false);
  assert.equal(classExpired(room, Date.parse('2027-11-06T12:00:00Z')), true);
});
test('student directory combines status, class, code and accent-insensitive searches', () => {
  const data = demoData();
  data.students[0].archived_at = '2026-11-06T12:00:00Z';
  assert.equal(filterStudents(data.students, data.classes, 'ana', 'active', '').length, 0);
  assert.equal(filterStudents(data.students, data.classes, 'A001', 'inactive', 'c1').length, 1);
  assert.equal(filterStudents(data.students, data.classes, '', 'inactive', 'c2').length, 0);
  assert.equal(filterStudents(data.students, data.classes, 'ciencias', 'all', '').length, 1);
});
