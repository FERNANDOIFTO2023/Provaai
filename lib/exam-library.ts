import type {ClassRoom, Exam, Student} from './model.ts';

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
