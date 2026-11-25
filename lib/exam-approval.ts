import type { Exam } from './model.ts';

type Approval = Pick<Exam, 'id' | 'status'>;

/** Aprova a versão já salva, sem reenviar conteúdo ou o parecer matemático. */
export async function approveSavedExam(
  saved: Exam,
  update: (approval: Approval) => Promise<Exam>,
): Promise<Exam> {
  const approved = await update({ id: saved.id, status: 'approved' });
  if (approved.id !== saved.id || approved.status !== 'approved') {
    throw new Error('A aprovação não foi confirmada. A prova continua salva como rascunho. Tente aprovar novamente.');
  }
  return approved;
}
