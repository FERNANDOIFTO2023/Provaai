/*
 * Provas / organização e busca
 * Agrupa provas por dia ou mês no fuso de São Paulo e normaliza buscas sem acentos. Mantém separados o
 * histórico coletivo e a seleção de alunos para provas individuais.
 */
import type {ClassRoom, Exam, Student} from './model.ts';

export const EXAM_TIME_ZONE = 'America/Sao_Paulo';
// A pasta usa a data de criação, nunca a última edição. O fuso é o mesmo exibido na prova.
export function examDays(exams: Exam[]) {
  const groups = new Map<string, {key: string; label: string; exams: Exam[]}>();
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: EXAM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  for (const exam of exams) {
    const date = new Date(exam.created_at);
    const fields = Number.isFinite(date.getTime()) ? formatter.formatToParts(date) : [];
    const key = fields.length ? ['year', 'month', 'day'].map(type => fields.find(part => part.type === type)!.value).join('-') : 'unknown';
    if (!groups.has(key)) groups.set(key, {key, label: examDate(exam.created_at), exams: []});
    groups.get(key)!.exams.push(exam);
  }
  // Datas ausentes ficam por último, sem descartar registros antigos nem alterar a lista recebida.
  return [...groups.values()].sort((a, b) => a.key === 'unknown' ? 1 : b.key === 'unknown' ? -1 : b.key.localeCompare(a.key))
    .map(group => ({...group, exams: group.exams.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))}));
}
export function examDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR', {timeZone: EXAM_TIME_ZONE});
}
// Calcula chave e rótulo no mesmo fuso para não deslocar provas próximas da virada do mês.
export function examMonths(exams: Exam[]) {
  const groups = new Map<string, {key: string; label: string; exams: Exam[]}>();
  const parts = new Intl.DateTimeFormat('en', {timeZone: EXAM_TIME_ZONE, year: 'numeric', month: '2-digit'});
  for (const exam of [...exams].sort((a,b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))) {
    const date = new Date(exam.created_at);
    const valid = Number.isFinite(date.getTime());
    const fields = valid ? parts.formatToParts(date) : [];
    const key = valid ? `${fields.find(p=>p.type==='year')!.value}-${fields.find(p=>p.type==='month')!.value}` : 'unknown';
    const label = valid ? date.toLocaleDateString('pt-BR', {timeZone: EXAM_TIME_ZONE, month:'long',year:'numeric'}) : 'Data não informada';
    if (!groups.has(key)) groups.set(key, {key, label, exams: []});
    groups.get(key)!.exams.push(exam);
  }
  return [...groups.values()];
}

export const matchesSearch = (text: string, query: string) => {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalize(text).includes(normalize(query.trim()));
};
export function regularExams(exams: Exam[], classId?: string) {
  return exams.filter(exam => exam.purpose !== 'recovery' && (!classId || exam.class_id === classId));
}
export function searchStudents(students: Student[], classes: ClassRoom[], query: string) {
  const rooms = new Map(classes.map(room => [room.id, room]));
  return students.filter(student => !student.archived_at && matchesSearch(
    `${student.name} ${student.code} ${rooms.get(student.class_id)?.name ?? ''} ${rooms.get(student.class_id)?.subject ?? ''}`,query,
  ));
}

// A lista ativa exige participação; a lista inativa oferece alunos arquivados para reativação.
export function individualStudents(students: Student[], classes: ClassRoom[], members: string[], inactive: boolean, query: string) {
  const rooms = new Map(classes.map(room => [room.id, room]));
  const enrolled = new Set(members);
  return students.filter(student => (inactive ? Boolean(student.archived_at) : !student.archived_at && enrolled.has(student.id)) && matchesSearch(
    `${student.name} ${student.code} ${rooms.get(student.class_id)?.name ?? ''} ${rooms.get(student.class_id)?.subject ?? ''}`, query,
  ));
}
