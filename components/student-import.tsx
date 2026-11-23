/*
 * Interface / importação de alunos
 * A prévia não grava registros. A confirmação reenvia o mesmo arquivo para validação no servidor.
 * Trocar a turma ou a planilha descarta a prévia; códigos só são atribuídos na gravação definitiva.
 */
import { useRef, useState } from 'react';
import type { ClassRoom, Student } from '@/lib/model';
import { apiFetch } from '@/lib/api-client';
import { Download, Upload, Users } from './animated-icons';

type PreviewStudent = Pick<Student, 'name' | 'level' | 'difficulties' | 'criteria'> & { line: number };
type RowError = { line?: number; message: string };

export default function StudentImport({ classes, busy, demo, onImported, classRoom }: {
  classes: ClassRoom[]; busy: boolean; demo: boolean; onImported: (students: Student[]) => void;
  classRoom?: ClassRoom;
}) {
  const [expanded, setExpanded] = useState(false);
  const [classId, setClassId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewStudent[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeClasses = classes.filter(room => !room.archived_at);
  // Dentro de uma turma, o destino fica fixo: a seleção global só é usada na tela Alunos.
  const destinationId = classRoom?.id ?? classId;
  const selected = activeClasses.find(room => room.id === destinationId);
  const disabled = busy || pending;

  function resetPreview() {
    setPreview([]); setErrors([]); setMessage('');
  }

  async function send(confirm: boolean) {
    if (!file || !selected || disabled || demo || inFlight.current || (confirm && !preview.length)) return;
    inFlight.current = true;
    setPending(true); setErrors([]); setMessage('');
    const form = new FormData();
    form.set('file', file); form.set('class_id', destinationId); form.set('preview', confirm ? '0' : '1');
    try {
      const response = await apiFetch('/api/students/import', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) {
        setPreview([]);
        const details: RowError[] = Array.isArray(result.errors)
          ? result.errors : Object.values(result.errors ?? {}).flat().map(value => ({ message: String(value) }));
        setErrors(details.length ? details : [{ message: response.status === 419 || response.status === 401
          ? 'Sua sessão expirou. Entre novamente e envie o arquivo.' : result.message || 'Não foi possível importar. Tente novamente.' }]);
        return;
      }
      if (!confirm) {
        setPreview(result.students);
        return;
      }
      // Usa os registros retornados para atualizar imediatamente a lista sem depender de uma nova busca.
      onImported(result.students);
      setPreview([]); setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage(`${result.count} ${result.count === 1 ? 'aluno cadastrado' : 'alunos cadastrados'} em ${selected.name}. Os códigos foram atribuídos automaticamente.`);
    } catch {
      setPreview([]);
      setErrors([{ message: 'Não foi possível confirmar a resposta. Confira a lista de alunos antes de tentar novamente; nomes já cadastrados serão sinalizados.' }]);
    } finally {
      setPending(false); inFlight.current = false;
    }
  }

  return <section className="student-import" aria-labelledby="student-import-title" aria-busy={pending}>
    <div className="student-import-heading">
      <span className="overview-symbol"><Users size={24} /></span>
      <div><span className="section-kicker">CADASTRO EM LOTE</span><h2 id="student-import-title">{classRoom ? `Alunos de ${classRoom.name}` : 'Traga sua lista de alunos'}</h2>
        <p>Preencha o modelo Excel e importe para uma turma. O site cria os códigos para você.</p></div>
      <div className="student-import-actions">
        <a className="button secondary" href="/modelos/modelo-alunos.xlsx" download><Download size={16} />Modelo Excel</a>
        {!classRoom && <button className="button primary" disabled={disabled} aria-expanded={expanded} aria-controls="student-import-form"
          onClick={() => setExpanded(value => !value)}><Upload size={16} />{expanded ? 'Fechar importação' : 'Importar alunos'}</button>}
      </div>
    </div>
    {(expanded || classRoom) && <div id="student-import-form" className="student-import-body">
      <p className="helper-note">Na aba Alunos do modelo, informe nome, nível, dificuldades/objetivos e critérios para as provas. Somente o nome é obrigatório. Nível em branco será Intermediário. Até 500 alunos e 5 MB por arquivo .xlsx.</p>
      <p className="helper-note">O arquivo cadastra cópias dos alunos na sua turma. Ele não dá acesso às turmas de outro professor nem altera os cadastros originais.</p>
      {demo ? <p role="status">Você pode baixar o modelo na demonstração. Entre na sua conta para importar alunos.</p>
        : !activeClasses.length || classRoom?.archived_at ? <p role="status">Crie ou reative uma turma antes de importar alunos.</p>
        : <>
          <div className="student-import-fields">
            <label>1. Turma de destino<select value={destinationId} disabled={disabled || !!classRoom} onChange={e => { setClassId(e.target.value); resetPreview(); }}>
              <option value="">Selecione uma turma</option>
              {activeClasses.map(room => <option key={room.id} value={room.id}>{room.name} · {room.subject}</option>)}
            </select></label>
            <label>2. Modelo preenchido<input ref={fileInput} type="file" accept=".xlsx" disabled={disabled} onChange={e => {
              resetPreview();
              const next = e.target.files?.[0] ?? null;
              if (next && (!/\.xlsx$/i.test(next.name) || next.size > 5 * 1024 * 1024)) {
                setFile(null); e.target.value = ''; setErrors([{ message: 'Escolha um arquivo .xlsx de até 5 MB.' }]);
              } else setFile(next);
            }} /></label>
            <button className="button secondary" disabled={disabled || !file || !selected} onClick={() => void send(false)}>
              {pending ? 'Processando…' : 'Conferir arquivo'}
            </button>
          </div>
          {!!errors.length && <div className="student-import-errors" role="alert"><strong>Revise o arquivo antes de importar</strong>
            <ul>{errors.map((error, i) => <li key={i}>{error.line ? `Linha ${error.line}: ` : ''}{error.message}</li>)}</ul>
          </div>}
          {!!preview.length && selected && <div className="student-import-preview">
            <h3>3. Confira {preview.length} {preview.length === 1 ? 'aluno' : 'alunos'} para {selected.name}</h3>
            <p className="helper-note">Nenhum aluno foi salvo ainda. Nomes repetidos ou já cadastrados na turma precisam ser conferidos. Para homônimos, use o cadastro manual.</p>
            <div className="student-import-table" tabIndex={0} role="region" aria-label="Prévia dos alunos">
              <table><thead><tr><th>Linha</th><th>Nome</th><th>Nível</th><th>Dificuldades e objetivos</th><th>Critérios para as provas</th></tr></thead>
                <tbody>{preview.map(student => <tr key={student.line}><td>{student.line}</td><td>{student.name}</td><td>{student.level}</td><td>{student.difficulties || 'Não informados'}</td><td>{student.criteria || 'Não informados'}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="student-import-actions"><button className="button primary" disabled={disabled} onClick={() => void send(true)}>
              {pending ? 'Cadastrando…' : `Confirmar importação de ${preview.length} ${preview.length === 1 ? 'aluno' : 'alunos'}`}
            </button><button className="button secondary" disabled={disabled} onClick={resetPreview}>Cancelar prévia</button></div>
          </div>}
        </>}
    </div>}
    {message && <p className="student-import-success" role="status">{message}</p>}
  </section>;
}
