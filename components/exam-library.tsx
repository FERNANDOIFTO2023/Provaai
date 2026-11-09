'use client';
import {useState} from 'react';
import {ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, FileText, Search, Sparkles} from './animated-icons';
import type {ClassRoom, Exam} from '@/lib/model';
import {matchesSearch, regularExams, examMonths, examDate} from '@/lib/exam-library';
import {Empty} from './workspace-ui';

export function ExamRows({exams, pending, onReview, selection, onSelect}: {
  exams: Exam[]; pending: string[]; onReview: (exam: Exam) => void;
  selection?: string[]; onSelect?: (id: string, checked: boolean) => void;
}) {
  return <div className="exam-months">{examMonths(exams).map(group => <section className="exam-month" key={group.key} aria-label={group.label}>
    <h2 className="exam-month-heading">{group.label}<span>{group.exams.length} {group.exams.length === 1 ? 'prova' : 'provas'}</span></h2>
    <div className="exam-list">{group.exams.map(exam => <div className="exam-row" key={exam.id}>
    {onSelect && <input type="checkbox" aria-label={`Selecionar ${exam.title} de ${exam.profile_snapshot.name}`}
      disabled={exam.status !== 'approved'} checked={selection?.includes(exam.id) ?? false}
      onChange={event => onSelect(exam.id,event.target.checked)} />}
    <span className="file-icon"><FileText size={22}/></span>
    <div className="exam-row-info"><h3>{exam.title}</h3><p>{exam.profile_snapshot.name} · {exam.profile_snapshot.code}</p>
      <small>{examDate(exam.created_at)} · {exam.content.questions.length} questões</small></div>
    <span className={`status ${exam.status === 'approved' ? 'good' : 'pending'}`}>
      {exam.status === 'approved' ? <CheckCircle2 size={14}/> : <Clock size={14}/>}
      {pending.includes(exam.id) ? 'Gerando…' : exam.status === 'approved' ? 'Aprovada' : 'Em revisão'}
    </span>
    <button className="button secondary small-button" disabled={pending.includes(exam.id)}
      onClick={() => onReview(exam)}>Revisar <ArrowRight size={15}/></button>
  </div>)}</div></section>)}</div>;
}

export default function ExamLibrary({classes, exams, pending, busy, generating, onReview, onPrepare, onDownload, roomId, onRoomChange}: {
  classes: ClassRoom[]; exams: Exam[]; pending: string[]; busy: boolean; generating: boolean;
  onReview: (exam: Exam) => void; onPrepare: (room: ClassRoom) => void;
  onDownload: (exams: Exam[], format: 'pdf'|'docx') => void;
  roomId: string | null; onRoomChange: (id: string | null) => void;
}) {
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState('all');
  const [selection,setSelection] = useState<string[]>([]);
  const [format,setFormat] = useState<'pdf'|'docx'>('pdf');
  const room = classes.find(item => item.id === roomId);
  const all = regularExams(exams);
  const filtered = regularExams(exams,roomId ?? undefined).filter(exam =>
    matchesSearch(`${exam.title} ${exam.profile_snapshot.name} ${exam.profile_snapshot.code} ${exam.subject}`,query) &&
    (status === 'all' || exam.status === status));
  const approved = filtered.filter(exam => exam.status === 'approved');
  const selected = approved.filter(exam => selection.includes(exam.id));
  function changeRoom(id: string|null) {onRoomChange(id);setQuery('');setSelection([]);setStatus('all');}
  return <section className="exam-library">
    {room && <button className="back-link" onClick={() => changeRoom(null)}><ArrowLeft size={16}/>Todas as turmas</button>}
    <div className="page-heading"><div><span className="eyebrow">PROVAS ORGANIZADAS POR TURMA</span>
      <h1>{room ? room.name : 'Provas coletivas'}<span>.</span></h1>
      <p>{room ? `${room.subject} · ${room.grade}. Revise, aprove e baixe as provas desta turma.` : 'Escolha a turma para preparar avaliações e acompanhar cada revisão.'}</p></div>
      {room && <button className="button primary" disabled={generating || busy || Boolean(room.archived_at)} onClick={() => onPrepare(room)}><Sparkles size={17}/>Preparar provas</button>}
    </div>
    <div className="library-filters"><div className="search"><Search size={17}/><input aria-label="Buscar provas"
      placeholder={room ? 'Buscar por aluno, código ou avaliação…' : 'Buscar turma, aluno ou avaliação…'} value={query}
      onChange={event => {setQuery(event.target.value);setSelection([]);}}/></div>
      {room && <label>Mostrar <select aria-label="Estado das provas" value={status} onChange={event => {setStatus(event.target.value);setSelection([]);}}>
        <option value="all">Todas as provas</option><option value="draft">Em revisão</option><option value="approved">Aprovadas</option>
      </select></label>}
    </div>
    {!room ? <div className="exam-class-grid">{classes.filter(item => matchesSearch(`${item.name} ${item.subject} ${item.grade}`,query) ||
      filtered.some(exam => exam.class_id === item.id)).map(item => {
      const list=all.filter(exam => exam.class_id === item.id), drafts=list.filter(exam => exam.status === 'draft').length;
      return <article className={`exam-class-card ${item.color}`} key={item.id}>
        <span className="eyebrow">{item.subject} · {item.grade}</span><h2>{item.name}</h2>
        <div className="class-exam-counts"><span><strong>{list.length}</strong> provas</span><span><strong>{drafts}</strong> em revisão</span><span><strong>{list.length-drafts}</strong> aprovadas</span></div>
        <div className="actions"><button className="button primary" onClick={() => changeRoom(item.id)}>Abrir provas <ArrowRight size={16}/></button>
          <button className="button secondary" disabled={generating || busy || Boolean(item.archived_at)} onClick={() => onPrepare(item)} aria-label={`Preparar provas de ${item.name}`}><PlusIcon/>Preparar</button></div>
      </article>;
    })}</div> : <>
      {!!approved.length && <div className="selection-bar"><label><input type="checkbox" checked={selected.length === approved.length}
        onChange={event => setSelection(event.target.checked ? approved.map(exam => exam.id) : [])}/>Selecionar aprovadas desta lista</label>
        <span>{selected.length} selecionadas</span><select aria-label="Formato de download" value={format} onChange={event => setFormat(event.target.value as 'pdf'|'docx')}><option value="pdf">PDF</option><option value="docx">DOCX</option></select>
        <button className="button secondary small-button" disabled={busy || !selected.length} onClick={() => onDownload(selected,format)}><Download size={16}/>Baixar {selected.length > 1 ? 'ZIP' : ''}</button></div>}
      <ExamRows exams={filtered} pending={pending} onReview={onReview} selection={selection}
        onSelect={(id,checked) => setSelection(current => checked ? [...current,id] : current.filter(value => value !== id))}/>
      {!filtered.length && <Empty title={query || status !== 'all' ? 'Nenhuma prova encontrada' : 'Esta turma ainda não tem provas'} text="Prepare uma avaliação ou ajuste os filtros acima."/>}
    </>}
    {!classes.length && <Empty title="Comece por uma turma" text="Cadastre uma turma e seus alunos em Minhas turmas."/>}
    {!room && !!classes.length && !classes.some(item => matchesSearch(`${item.name} ${item.subject} ${item.grade}`,query) || filtered.some(exam => exam.class_id === item.id)) && <Empty title="Nenhuma turma encontrada" text="Tente outro nome, aluno ou título de avaliação."/>}
  </section>;
}
function PlusIcon() {return <Sparkles size={15}/>;}
