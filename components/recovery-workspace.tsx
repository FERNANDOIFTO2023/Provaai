'use client';
import {useRef, useState, type CSSProperties} from 'react';
import {Plus, Search, Sparkles, GraduationCap, Users, Clock, CheckCircle2, ArrowRight, BookOpen} from './animated-icons';
import {classColor} from '@/lib/class-appearance';
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
  const searchInput = useRef<HTMLInputElement>(null);
  const candidates=searchStudents(students,classes,query).filter(student => !members.includes(student.id) && (!classId || student.class_id === classId));
  const enrolled=individualStudents(students,classes,members,showArchived,memberQuery);
  const recoveryExams=exams.filter(exam => exam.purpose === 'recovery');
  const activeCount = individualStudents(students, classes, members, false, '').length;
  const reviewCount = recoveryExams.filter(exam => exam.status === 'draft').length;
  return <section className="recovery-workspace individual-workspace">
    <div className="page-heading"><div><span className="eyebrow">UM NOVO MOMENTO PARA APRENDER</span><h1>Provas individuais<span>.</span></h1>
      <p>Um olhar para cada aluno. Prepare, acompanhe e revise suas avaliações.</p></div>
      <button type="button" className="button primary" onClick={() => searchInput.current?.focus()}><Plus size={18}/>Adicionar aluno</button></div>
    <dl className="individual-summary">
      <div><span className="summary-icon"><Users size={20}/></span><dt>Alunos acompanhados</dt><dd>{activeCount}</dd></div>
      <div><span className="summary-icon amber"><Clock size={20}/></span><dt>Provas em revisão</dt><dd>{reviewCount}</dd></div>
      <div><span className="summary-icon mint"><CheckCircle2 size={20}/></span><dt>Provas aprovadas</dt><dd>{recoveryExams.filter(exam => exam.status === 'approved').length}</dd></div>
    </dl>
    <section className="recovery-add"><div className="recovery-add-intro"><span className="section-kicker">COMECE POR AQUI</span><h2>Quem precisa de uma nova avaliação?</h2><p>Encontre um aluno e adicione à lista. Ele continua na turma de origem.</p></div>
      <div className="recovery-add-search"><div className="library-filters"><div className="search"><Search size={17}/><input ref={searchInput} aria-label="Buscar aluno para prova individual" placeholder="Busque por nome, código ou turma…" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <select aria-label="Filtrar alunos por turma" value={classId} onChange={event => setClassId(event.target.value)}><option value="">Todas as turmas</option>{classes.map(room => <option key={room.id} value={room.id}>{room.name} · {room.subject}</option>)}</select></div>
      {query.trim() || classId ? <><div className="recovery-results">{candidates.slice(0,20).map(student => <div key={student.id}>
        <span><strong>{student.name}</strong><small>{student.code} · {classes.find(room => room.id === student.class_id)?.name}</small></span>
        <button className="button secondary small-button" disabled={busy} onClick={() => onAdd(student)} aria-label={`Adicionar ${student.name} a Provas individuais`}><Plus size={15}/>Adicionar</button>
      </div>)}</div><p className="helper-note" role="status">{candidates.length ? `${Math.min(candidates.length,20)} de ${candidates.length} alunos disponíveis. Refine a busca se necessário.` : 'Nenhum aluno disponível nesta busca. Confira os já adicionados abaixo.'}</p></> : <p className="helper-note"><Search size={14}/>Busque um nome ou escolha uma turma para começar.</p>}
      </div>
    </section>
    <div className="section-heading individual-list-heading"><div><span className="section-kicker">ACOMPANHAMENTO</span><h2>Alunos para provas individuais <span className="count-pill">{enrolled.length}</span></h2></div></div>
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
      const drafts = history.filter(exam => exam.status === 'draft').length;
      return <article className="recovery-card" key={student.id} style={{'--student-accent': classColor(room?.color ?? 'sage')} as CSSProperties}><div className="recovery-card-heading"><span className="student-monogram" aria-hidden="true">{student.name.split(' ').filter(Boolean).slice(0,2).map(word => word[0]).join('').toUpperCase()}</span>
        <div><div className="student-title"><h3>{student.name}</h3><span className={`status ${student.archived_at ? 'pending' : 'good'}`}>{student.archived_at ? 'Inativo' : 'Ativo'}</span></div><p>{student.code} · {room?.name} · {room?.subject}</p></div>
        {student.archived_at ? <button className="button primary" disabled={busy || generating} aria-label={`Reativar ${student.name}`} onClick={() => onReactivate(student)}>
          Reativar aluno</button> : <button className="button primary" disabled={busy || generating || Boolean(room?.archived_at)} onClick={() => onPrepare(student)} aria-label={`Preparar prova individual de ${student.name}`}><Sparkles size={16}/>Preparar prova</button>}</div>
        <div className="student-learning-note"><BookOpen size={17}/><p><strong>Foco pedagógico</strong>{student.difficulties || student.criteria || 'Defina os conteúdos ao preparar a primeira prova.'}</p></div>
        {history.length ? <details className="student-exam-history" open><summary><span><GraduationCap size={18}/>{history.length} {history.length === 1 ? 'prova individual' : 'provas individuais'}</span><span className="history-review-count">{drafts ? `${drafts} em revisão` : 'Revisões em dia'}<ArrowRight size={16}/></span></summary>
          <ExamRows exams={history} pending={pending} onReview={onReview}/></details> : <div className="student-first-exam"><GraduationCap size={19}/><span>A próxima etapa é preparar a primeira prova.</span><ArrowRight size={16}/></div>}
      </article>;
    })}</div>
    {!enrolled.length && <Empty
      title={memberQuery ? 'Nenhum aluno encontrado' : showArchived ? 'Nenhum aluno inativo' : 'Nenhum aluno ativo nesta lista'}
      text={memberQuery ? 'Tente outro nome, código ou turma, ou altere o filtro de situação.' : showArchived
        ? 'Alunos retirados de qualquer turma aparecem aqui, com suas provas preservadas.'
        : 'Adicione alunos pela busca acima ou pelo atalho na turma.'}/>}
  </section>;
}
