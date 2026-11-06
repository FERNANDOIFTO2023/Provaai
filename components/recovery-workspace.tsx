'use client';
import {useState} from 'react';
import {Plus, Search, Sparkles, GraduationCap} from './animated-icons';
import type {ClassRoom, Exam, Student} from '@/lib/model';
import {searchStudents, matchesSearch} from '@/lib/exam-library';
import {ExamRows} from './exam-library';
import {Empty} from './workspace-ui';

export default function RecoveryWorkspace({classes, students, members, exams, busy, generating, pending, onAdd, onPrepare, onReview}: {
  classes: ClassRoom[]; students: Student[]; members: string[]; exams: Exam[];
  busy: boolean; generating: boolean; pending: string[];
  onAdd: (student: Student) => void; onPrepare: (student: Student) => void; onReview: (exam: Exam) => void;
}) {
  const [query,setQuery]=useState('');
  const [classId,setClassId]=useState('');
  const [memberQuery,setMemberQuery]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const candidates=searchStudents(students,classes,query).filter(student => !members.includes(student.id) && (!classId || student.class_id === classId));
  const enrolled=students.filter(student => members.includes(student.id) && Boolean(student.archived_at) === showArchived && matchesSearch(`${student.name} ${student.code} ${classes.find(room => room.id === student.class_id)?.name ?? ''}`,memberQuery));
  const recoveryExams=exams.filter(exam => exam.purpose === 'recovery');
  return <section className="recovery-workspace">
    <div className="page-heading"><div><span className="eyebrow">UM NOVO MOMENTO PARA APRENDER</span><h1>Provas individuais<span>.</span></h1>
      <p>Prepare uma avaliação individual. O aluno continua na turma de origem.</p></div></div>
    <section className="recovery-add"><h2><Plus size={20}/>Adicionar aluno a Provas individuais</h2>
      <div className="library-filters"><div className="search"><Search size={17}/><input aria-label="Buscar aluno para prova individual" placeholder="Nome, código ou turma do aluno…" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <select aria-label="Filtrar alunos por turma" value={classId} onChange={event => setClassId(event.target.value)}><option value="">Todas as turmas</option>{classes.map(room => <option key={room.id} value={room.id}>{room.name} · {room.subject}</option>)}</select></div>
      {query.trim() || classId ? <><div className="recovery-results">{candidates.slice(0,20).map(student => <div key={student.id}>
        <span><strong>{student.name}</strong><small>{student.code} · {classes.find(room => room.id === student.class_id)?.name}</small></span>
        <button className="button secondary small-button" disabled={busy} onClick={() => onAdd(student)} aria-label={`Adicionar ${student.name} a Provas individuais`}><Plus size={15}/>Adicionar</button>
      </div>)}</div><p className="helper-note" role="status">{candidates.length ? `${Math.min(candidates.length,20)} de ${candidates.length} alunos disponíveis. Refine a busca se necessário.` : 'Nenhum aluno disponível nesta busca. Confira os já adicionados abaixo.'}</p></> : <p className="helper-note">Busque um aluno já cadastrado ou escolha uma turma. Também é possível encaminhá-lo pela lista da turma.</p>}
    </section>
    <div className="section-heading"><h2>{showArchived ? 'Histórico de alunos retirados' : 'Alunos para provas individuais'}</h2><button className="button secondary small-button" onClick={() => setShowArchived(value => !value)}>{showArchived ? 'Ver alunos ativos' : 'Histórico de retirados'}</button><div className="search"><Search size={17}/><input aria-label="Filtrar alunos para provas individuais" placeholder="Buscar nesta lista…" value={memberQuery} onChange={event => setMemberQuery(event.target.value)}/></div></div>
    <div className="recovery-list">{enrolled.map(student => {
      const room=classes.find(item => item.id === student.class_id);
      const history=recoveryExams.filter(exam => exam.student_id === student.id);
      return <article className="recovery-card" key={student.id}><div className="recovery-card-heading"><span className="file-icon"><GraduationCap size={22}/></span>
        <div><h3>{student.name}</h3><p>{student.code} · {room?.name} · {room?.subject}</p></div>
        <button className="button primary" disabled={busy || generating || Boolean(student.archived_at)} onClick={() => onPrepare(student)} aria-label={`Preparar prova individual de ${student.name}`}><Sparkles size={16}/>{student.archived_at ? 'Aluno retirado da turma' : 'Preparar prova'}</button></div>
        <p className="recovery-profile">{student.difficulties || student.criteria || 'A prova seguirá os tópicos informados e o perfil do aluno.'}</p>
        {history.length ? <details open><summary>{history.length} {history.length === 1 ? 'prova individual' : 'provas individuais'} · {history.filter(exam => exam.status === 'draft').length} em revisão</summary>
          <ExamRows exams={history} pending={pending} onReview={onReview}/></details> : <p className="helper-note">Nenhuma prova individual preparada ainda.</p>}
      </article>;
    })}</div>
    {!enrolled.length && <Empty title={memberQuery ? 'Nenhum aluno encontrado' : 'Um espaço para acompanhar cada aluno'} text="Adicione alunos pela busca acima ou pelo atalho na turma."/>}
  </section>;
}
