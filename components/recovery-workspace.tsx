'use client';
import {useState} from 'react';
import {Plus, Search, Sparkles, GraduationCap} from './animated-icons';
import type {ClassRoom, Exam, Student} from '@/lib/model';
import {searchStudents, individualStudents} from '@/lib/exam-library';
import {ExamRows} from './exam-library';
import {Empty} from './workspace-ui';

export default function RecoveryWorkspace({classes, students, members, exams, busy, generating, pending, onAdd, onPrepare, onReview, onReactivate}: {
  classes: ClassRoom[]; students: Student[]; members: string[]; exams: Exam[];
  busy: boolean; generating: boolean; pending: string[];
  onAdd: (student: Student) => void; onPrepare: (student: Student) => void; onReview: (exam: Exam) => void;
  onReactivate: (student: Student) => void;
}) {
  const [query,setQuery]=useState('');
  const [classId,setClassId]=useState('');
  const [memberQuery,setMemberQuery]=useState('');
  const [showArchived,setShowArchived]=useState(false);
  const candidates=searchStudents(students,classes,query).filter(student => !members.includes(student.id) && (!classId || student.class_id === classId));
  const enrolled=individualStudents(students,classes,members,showArchived,memberQuery);
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
    <div className="section-heading"><h2>Alunos para provas individuais</h2></div>
    <div className="library-filters">
      <div className="search"><Search size={17}/><input aria-label="Filtrar alunos para provas individuais" placeholder="Buscar nesta lista…" value={memberQuery} onChange={event => setMemberQuery(event.target.value)}/></div>
      <select aria-label="Situação dos alunos" value={showArchived ? 'inactive' : 'active'} onChange={event => setShowArchived(event.target.value === 'inactive')}>
        <option value="active">Alunos ativos</option>
        <option value="inactive">Alunos inativos</option>
      </select>
    </div>
    <div className="recovery-list">{enrolled.map(student => {
      const room=classes.find(item => item.id === student.class_id);
      const history=recoveryExams.filter(exam => exam.student_id === student.id);
      return <article className="recovery-card" key={student.id}><div className="recovery-card-heading"><span className="file-icon"><GraduationCap size={22}/></span>
        <div><h3>{student.name}</h3><p>{student.code} · {room?.name} · {room?.subject}</p><span className={`status ${student.archived_at ? 'pending' : 'good'}`}>{student.archived_at ? 'Inativo' : 'Ativo'}</span></div>
        {student.archived_at ? <button className="button primary" disabled={busy || generating} aria-label={`Reativar ${student.name}`} onClick={() => onReactivate(student)}>
          Reativar aluno</button> : <button className="button primary" disabled={busy || generating || Boolean(room?.archived_at)} onClick={() => onPrepare(student)} aria-label={`Preparar prova individual de ${student.name}`}><Sparkles size={16}/>Preparar prova</button>}</div>
        <p className="recovery-profile">{student.difficulties || student.criteria || 'A prova seguirá os tópicos informados e o perfil do aluno.'}</p>
        {history.length ? <details open><summary>{history.length} {history.length === 1 ? 'prova individual' : 'provas individuais'} · {history.filter(exam => exam.status === 'draft').length} em revisão</summary>
          <ExamRows exams={history} pending={pending} onReview={onReview}/></details> : <p className="helper-note">Nenhuma prova individual preparada ainda.</p>}
      </article>;
    })}</div>
    {!enrolled.length && <Empty
      title={memberQuery ? 'Nenhum aluno encontrado' : showArchived ? 'Nenhum aluno inativo' : 'Nenhum aluno ativo nesta lista'}
      text={memberQuery ? 'Tente outro nome, código ou turma, ou altere o filtro de situação.' : showArchived
        ? 'Alunos retirados de qualquer turma aparecem aqui, com suas provas preservadas.'
        : 'Adicione alunos pela busca acima ou pelo atalho na turma.'}/>}
  </section>;
}
