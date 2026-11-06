import type { ClassRoom, Student } from './model.ts';
import { matchesSearch } from './exam-library.ts';

export type ShareTarget = { kind: 'class' | 'student'; id: string; name: string };
export type CopyInvitation = {
  id: string; owner_id: string; sender_email: string; recipient_email: string;
  kind: 'class' | 'student'; resource_name: string; created_at: string;
  accepted_at: string | null; revoked_at: string | null;
  student_count: number;
};
export function classExpired(room: ClassRoom, time = Date.now()) {
  return Boolean(room.archived_at && room.deletion_due_at && Date.parse(room.deletion_due_at) <= time);
}
export function deletionDate(archivedAt: string) {
  const date = new Date(archivedAt);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString();
}
export function filterStudents(students: Student[], classes: ClassRoom[], query: string, status: string, classId: string) {
  const rooms = new Map(classes.map(room => [room.id, room]));
  return students.filter(student => (!classId || student.class_id === classId) &&
    (status === 'all' || Boolean(student.archived_at) === (status === 'inactive')) &&
    matchesSearch(`${student.name} ${student.code} ${rooms.get(student.class_id)?.name ?? ''} ${rooms.get(student.class_id)?.subject ?? ''}`, query));
}
