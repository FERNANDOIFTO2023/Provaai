'use client';
import { useState } from 'react';
import type { ClassRoom, Exam, Student } from '@/lib/model';
import { filterStudents } from '@/lib/classroom';
import { Search, Pencil, Users } from './animated-icons';
import { Empty } from './workspace-ui';

export default function StudentsWorkspace({ students, classes, exams, busy, onEdit, onShare, onArchive, onReactivate, onClass }: {
  students: Student[]; classes: ClassRoom[]; exams: Exam[]; busy: boolean;
  onEdit: (student: Student) => void; onShare: (student: Student) => void;
  onArchive: (student: Student) => void; onReactivate: (student: Student) => void;
  onClass: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [classId, setClassId] = useState('');
  const filtered = filterStudents(students, classes, query, status, classId);
  return <section>
    <div className="page-heading"><div><span className="eyebrow">CADA ALUNO, UMA POSSIBILIDADE</span>
      <h1>Alunos<span>.</span></h1><p>Encontre os perfis, acompanhe os vínculos e compartilhe uma cópia com outro professor.</p>
    </div></div>
    <div className="library-filters">
      <div className="search"><Search size={17} /><input aria-label="Buscar alunos" placeholder="Nome, código, turma ou matéria…" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <select aria-label="Status dos alunos" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos os alunos</option>
      </select>
      <select aria-label="Turma dos alunos" value={classId} onChange={e => setClassId(e.target.value)}><option value="">Todas as turmas</option>
        {classes.map(room => <option key={room.id} value={room.id}>{room.name}{room.archived_at ? ' · Inativa' : ''}</option>)}
      </select>
    </div>
    <p className="helper-note" role="status">{filtered.length} {filtered.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}. O status do aluno é independente do status da turma.</p>
    <div className="student-directory">{filtered.map(student => {
      const room = classes.find(item => item.id === student.class_id);
      const previous = classes.filter(item => item.id !== student.class_id && exams.some(exam => exam.student_id === student.id && exam.class_id === item.id));
      return <article className="directory-card" key={student.id}>
        <div className="directory-heading"><span className="file-icon"><Users size={22} /></span><div><h2>{student.name}</h2><p>{student.code} · {student.level}</p></div>
          <span className={`status ${student.archived_at ? 'pending' : 'good'}`}>{student.archived_at ? 'Inativo' : 'Ativo'}</span></div>
        <p>Turma vinculada: <button className="text-button" onClick={() => onClass(student.class_id)}>{room?.name ?? 'Turma'}{room?.archived_at ? ' (inativa)' : ''}</button></p>
        {!!previous.length && <p className="helper-note">Histórico de provas: {previous.map(item => item.name).join(', ')}.</p>}
        <dl className="student-profile"><dt>Dificuldades</dt><dd>{student.difficulties || 'Não informadas'}</dd><dt>Critérios pedagógicos</dt><dd>{student.criteria || 'Não informados'}</dd></dl>
        <div className="actions">
          <button className="button secondary small-button" disabled={busy} onClick={() => onEdit(student)}><Pencil size={16} />Editar perfil</button>
          <button className="button secondary small-button" disabled={busy} onClick={() => onShare(student)}>Compartilhar cópia</button>
          {student.archived_at ? <button className="button secondary small-button" disabled={busy} onClick={() => onReactivate(student)}>Reativar aluno</button>
            : <button className="button secondary small-button" disabled={busy} onClick={() => onArchive(student)}>Inativar aluno</button>}
        </div>
      </article>;
    })}</div>
    {!filtered.length && <Empty title="Nenhum aluno encontrado" text="Ajuste os filtros ou cadastre alunos dentro de uma turma." />}
  </section>;
}
