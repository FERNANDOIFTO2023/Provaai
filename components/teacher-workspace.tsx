'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Users,
  Plus,
  Search,
  FileText,
  LayoutGrid,
  Settings,
  LogOut,
  Check,
  CheckCircle2,
  Download,
  Upload,
  SlidersHorizontal,
  Sparkles,
  X,
  GraduationCap,
  Clock,
  FolderOpen,
  Printer,
  Loader2,
  Menu,
  Leaf,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import QuestionCounts from './question-counts';
import { questionMix } from '@/supabase/functions/_shared/question-mix';
import { BloubMood } from './motion';
import {
  classSchema,
  studentSchema,
  cleanError,
  demoData,
  examContentSchema,
  duplicateQuestions,
  type DataSet,
  type ClassRoom,
  type Student,
  type Exam,
  type Template,
} from '@/lib/model';
import { downloadExams } from '@/lib/export';
import { Dialog, Field, Empty } from './workspace-ui';
type Modal = 'class' | 'student' | 'generate' | 'template' | 'exam' | null;
const empty: DataSet = { classes: [], students: [], exams: [], templates: [] };
const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
export type Teacher = { id: string; email?: string };
const sections = [
  { id: 'classes', short: 'Turmas', name: 'Minhas turmas', icon: LayoutGrid },
  { id: 'exams', short: 'Provas', name: 'Minhas provas', icon: FileText },
  {
    id: 'templates',
    short: 'Modelos',
    name: 'Modelos de prova',
    icon: FolderOpen,
  },
  { id: 'settings', short: 'Ajustes', name: 'Ajustes', icon: Settings },
];

export default function TeacherWorkspace({
  user,
  demo,
  leaveDemo,
  onPendingChange,
  startNavigation,
}: {
  user: Teacher | null;
  demo: boolean;
  leaveDemo: () => void;
  onPendingChange: (pending: boolean) => void;
  startNavigation: (change: () => void) => void;
}) {
  const [data, setData] = useState<DataSet>(() => (demo ? demoData() : empty)),
    [view, setView] = useState('classes'),
    [current, setCurrent] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [modal, setModal] = useState<Modal>(null),
    [editing, setEditing] = useState<Student | null>(null),
    [exam, setExam] = useState<Exam | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dbError, setDbError] = useState(''),
    [selection, setSelection] = useState<string[]>([]),
    [ai, setAi] = useState(false),
    [mobile, setMobile] = useState(false),
    [progress, setProgress] = useState(''),
    [templateText, setTemplateText] = useState(''),
    [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const active = data.classes.find((c) => c.id === current),
    students = data.students.filter((s) => s.class_id === current),
    totalProfiles = data.students.filter(
      (s) => s.difficulties || s.criteria,
    ).length;
  const classListHeading = useRef<HTMLHeadingElement>(null);
  const [initialLoad, setInitialLoad] = useState(!demo);
  const [configPending, setConfigPending] = useState(true);
  const screenPending = initialLoad || (view === 'settings' && configPending);
  useLayoutEffect(() => {
    onPendingChange(screenPending);
    return () => onPendingChange(false);
  }, [screenPending, onPendingChange]);
  const approved = data.exams.filter((e) => e.status === 'approved');
  async function load() {
    const results = await Promise.all(
      ['sala_classes', 'sala_students', 'sala_exams', 'sala_templates'].map(
        (t) =>
          supabase
            .from(t)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      setDbError(cleanError(failed.error));
      return;
    }
    setDbError('');
    setData({
      classes: results[0].data as ClassRoom[],
      students: results[1].data as Student[],
      exams: results[2].data as Exam[],
      templates: results[3].data as Template[],
    });
  }
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json() as Promise<{ aiConfigured: boolean }>)
      .then((v) => setAi(v.aiConfigured))
      .catch(() => {})
      .finally(() => setConfigPending(false));
  }, []);
  const userId = user?.id;
  useEffect(() => {
    if (!userId || demo) return;
    let mounted = true;
    load()
      .catch((error) => {
        if (mounted) setDbError(cleanError(error));
      })
      .finally(() => {
        if (mounted) setInitialLoad(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId, demo]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(id);
  }, [message]);
  function navigate(next: string) {
    startNavigation(() => {
      setView(next);
      setCurrent(null);
      setSearch('');
      setSelection([]);
      setMobile(false);
    });
  }
  function open(m: Modal) {
    setError('');
    setModal(m);
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }
  async function persist(
    kind: keyof DataSet,
    table: string,
    value: Record<string, unknown>,
    update = false,
  ) {
    if (demo) {
      setData((d) => ({
        ...d,
        [kind]: update
          ? (d[kind] as { id: string }[]).map((r) =>
              r.id === value.id ? value : r,
            )
          : [value, ...d[kind]],
      }));
      return value;
    }
    let query = update
      ? supabase.from(table).update(value).eq('id', value.id)
      : supabase.from(table).insert(value);
    const { data: saved, error } = await query.select().single();
    if (error) throw error;
    await load();
    return saved;
  }
  const uid = demo ? 'demo' : user?.id;
  const now = () => new Date().toISOString();
  async function saveClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      const parsed = classSchema.safeParse(form);
      if (!parsed.success)
        throw new Error('Preencha nome, série e matéria da turma.');
      const id = crypto.randomUUID();
      await persist('classes', 'sala_classes', {
        ...parsed.data,
        id,
        user_id: uid,
        created_at: now(),
        period: '',
      });
      navigate('classes');
      setCurrent(id);
      setModal(null);
      setMessage('Turma criada. Agora você pode cadastrar os alunos.');
    });
  }
  async function saveStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      const parsed = studentSchema.safeParse(form);
      if (!parsed.success)
        throw new Error('Confira os campos do aluno e o tamanho dos textos.');
      if (
        data.students.some(
          (s) =>
            s.class_id === current &&
            s.code === parsed.data.code &&
            s.id !== editing?.id,
        )
      )
        throw new Error('Já existe um aluno com esse código nesta turma.');
      await persist(
        'students',
        'sala_students',
        {
          ...parsed.data,
          id: editing?.id || crypto.randomUUID(),
          class_id: current,
          user_id: uid,
          created_at: editing?.created_at || now(),
        },
        !!editing,
      );
      setModal(null);
      setMessage('Perfil do aluno salvo.');
    });
  }
  async function generateOne(item: Exam) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        examId: item.id,
        objectiveCount: item.content.objectiveCount,
      }),
    });
    const body = (await r.json()) as {
      error?: { message?: string };
      exam: Exam;
    };
    if (!r.ok) throw new Error(body.error?.message || 'Falha na geração.');
    return body.exam as Exam;
  }
  async function createExams(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const room = active;
      if (view !== 'classes' || !room)
        throw new Error('Abra uma turma para preparar as provas.');
      const ids = new Set(f.getAll('student').map(String));
      const selected = students.filter((student) => ids.has(student.id));
      if (!selected.length || selected.length !== ids.size)
        throw new Error('Selecione pelo menos um aluno desta turma.');
      const title = String(f.get('title')).trim(),
        topics = String(f.get('topics')).trim(),
        count = Number(f.get('count'));
      if (!title || !topics || count < 1 || count > 30)
        throw new Error('Informe título, tópicos e de 1 a 30 questões.');
      const objectiveCount = questionMix(
        count,
        Number(f.get('objectiveCount')),
      ).objective;
      const aiMode = f.get('mode') === 'ai';
      if (demo && aiMode)
        throw new Error(
          'A demonstração não envia dados à IA. Use uma conta para gerar provas reais.',
        );
      if (aiMode && !ai)
        throw new Error('A IA ainda não está configurada no servidor.');
      let failures = 0;
      for (let i = 0; i < selected.length; i++) {
        const s = selected[i];
        setProgress(`Preparando ${i + 1} de ${selected.length}: ${s.name}`);
        const item: Exam = {
          id: crypto.randomUUID(),
          user_id: uid!,
          class_id: room.id,
          student_id: s.id,
          title,
          subject: room.subject,
          topics,
          question_count: count,
          template_id: String(f.get('template_id') || '') || null,
          status: 'draft',
          content: {
            objectiveCount,
            instructions:
              'Leia as questões com atenção. Apresente o desenvolvimento das respostas.',
            questions: [],
          },
          profile_snapshot: {
            name: s.name,
            code: s.code,
            difficulties: s.difficulties,
            criteria: s.criteria,
            level: s.level,
          },
          created_at: now(),
          updated_at: now(),
        };
        await persist('exams', 'sala_exams', item);
        if (aiMode) {
          try {
            await generateOne(item);
          } catch {
            failures++;
          }
        }
      }
      if (!demo) await load();
      setProgress('');
      setModal(null);
      navigate('exams');
      setMessage(
        failures
          ? `${failures} prova(s) aguardam geração. Os rascunhos foram preservados para tentar novamente.`
          : 'Provas criadas. Revise o conteúdo antes de aprovar.',
      );
    });
    setProgress('');
  }
  async function saveExam(approve = false) {
    if (!exam) return;
    await action(async () => {
      const parsed = examContentSchema.safeParse(exam.content);
      if (!parsed.success)
        throw new Error(
          'Confira as questões: enunciado, objetivo, resposta e quatro alternativas nas objetivas são obrigatórios.',
        );
      if (
        duplicateQuestions(
          parsed.data,
          data.exams
            .filter(
              (e) =>
                e.id !== exam.id &&
                e.class_id === exam.class_id &&
                e.title === exam.title,
            )
            .map((e) => e.content),
        )
      )
        throw new Error(
          'Há uma questão idêntica nesta avaliação. Edite-a antes de continuar.',
        );
      const saved = (await persist(
        'exams',
        'sala_exams',
        { ...exam, content: parsed.data, status: 'draft', updated_at: now() },
        true,
      )) as Exam;
      if (approve) {
        const approved = (await persist(
          'exams',
          'sala_exams',
          { ...saved, status: 'approved' },
          true,
        )) as Exam;
        setExam(approved);
      } else setExam(saved);
      setMessage(
        approve
          ? 'Prova aprovada e disponível para download.'
          : 'Rascunho salvo.',
      );
    });
  }
  async function processTemplate(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch('/api/template/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (session?.access_token || ''),
      },
      body: JSON.stringify({ templateId: id }),
    });
    const result = (await r.json()) as { error?: { message: string } };
    await load();
    if (!r.ok)
      throw new Error(result.error?.message || 'Falha ao ler o modelo.');
  }
  async function uploadTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const file = f.get('file') as File;
      if (!file?.size || file.size > 20 * 1024 * 1024)
        throw new Error('Escolha um arquivo de até 20 MB.');
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext || ''))
        throw new Error('Use PDF, DOC ou DOCX.');
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const valid =
        ext === 'pdf'
          ? new TextDecoder().decode(bytes).startsWith('%PDF-')
          : ext === 'docx'
            ? bytes[0] === 80 && bytes[1] === 75
            : bytes[0] === 208 && bytes[1] === 207;
      if (!valid)
        throw new Error(
          'O conteúdo do arquivo não corresponde ao formato informado.',
        );
      const id = crypto.randomUUID(),
        path = `${uid}/${id}.${ext}`;
      if (!demo) {
        const { error } = await supabase.storage
          .from('sala-templates')
          .upload(path, file, {
            contentType:
              ext === 'pdf'
                ? 'application/pdf'
                : ext === 'doc'
                  ? 'application/msword'
                  : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        if (error) throw error;
      }
      try {
        await persist('templates', 'sala_templates', {
          id,
          user_id: uid,
          name: String(f.get('name')),
          filename: file.name,
          path,
          reference_text: templateText,
          created_at: now(),
        });
      } catch (e) {
        if (!demo) await supabase.storage.from('sala-templates').remove([path]);
        throw e;
      }
      setModal(null);
      if (!demo) {
        await processTemplate(id);
      }
      setMessage(
        'Modelo salvo e lido. Confira o texto extraído antes de gerar provas.',
      );
    });
  }
  async function signout() {
    if (busy) return;
    if (demo) {
      leaveDemo();
      return;
    }
    await action(async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    });
  }
  const filteredExams = data.exams.filter((e) =>
    `${e.title} ${e.profile_snapshot.name} ${e.subject}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <button
          type="button"
          className="brand brand-button"
          onClick={() => navigate('classes')}
          aria-label="Provaai, minhas turmas"
        >
          <img src="/bloub/bloub-symbol.svg" alt="" width="40" height="40" />
          Provaai<span className="brand-dot">.</span>
        </button>
        <div className="workspace">
          <span className="workspace-avatar">
            <GraduationCap size={19} />
          </span>
          <div>
            <strong>Meu espaço</strong>
            <small>Área do professor</small>
          </div>
        </div>
        <span className="nav-caption">ORGANIZAR & ENSINAR</span>
        <nav aria-label="Menu lateral">
          {sections.slice(0, 3).map((n) => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.name}
              {n.id === 'exams' && data.exams.length > 0 && (
                <span className="nav-count">{data.exams.length}</span>
              )}
            </button>
          ))}
        </nav>
        <nav className="bottom-nav">
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => navigate('settings')}
          >
            <Settings size={19} />
            Ajustes
          </button>
        </nav>
        <button
          type="button"
          className="profile"
          disabled={busy}
          onClick={() => void signout()}
          aria-label="Sair da conta"
          title="Sair da conta"
        >
          <span className="avatar">
            {demo ? 'PR' : initials(user?.email || 'Professor')}
          </span>
          <span>
            <strong>
              {demo ? 'Professor visitante' : user?.email?.split('@')[0]}
            </strong>
            <small>{demo ? 'Modo demonstração' : 'Conta do professor'}</small>
          </span>
          <LogOut size={17} aria-hidden="true" />
        </button>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="Abrir menu"
            aria-expanded={mobile}
          >
            <Menu />
          </button>
          <nav className="section-nav" aria-label="Telas do professor">
            {sections.map((section) => (
              <button
                type="button"
                key={section.id}
                aria-current={view === section.id ? 'page' : undefined}
                onClick={() => navigate(section.id)}
              >
                {section.short}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
            <span className="session-label">
              {demo ? 'Demonstração' : user?.email}
            </span>
            <button
              type="button"
              className="session-exit"
              disabled={busy}
              onClick={() => void signout()}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </header>
        <main className="main-content" key={view + String(current)}>
          {dbError && (
            <div className="notice">
              <AlertCircle size={19} />
              <span>{dbError}</span>
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Fechar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'classes' && !active && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SEU DIA COMEÇA AQUI</span>
                  <h1>
                    Minhas turmas<span>.</span>
                  </h1>
                  <p>
                    Cada turma tem uma história. Cada aluno, seu próprio ritmo.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => open('class')}
                >
                  <Plus size={18} />
                  Nova turma
                </button>
              </div>
              <section className="welcome-banner">
                <div>
                  <span className="tag">MAIS TEMPO PARA ENSINAR</span>
                  <h2>
                    Uma avaliação que faz sentido
                    <br />
                    para <em>cada aluno.</em>
                  </h2>
                  <p>
                    Crie uma turma e cadastre os alunos. Depois, abra a turma
                    para preparar as provas individuais.
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      data.classes.length
                        ? classListHeading.current?.focus()
                        : open('class')
                    }
                  >
                    {data.classes.length
                      ? 'Escolher uma turma'
                      : 'Criar primeira turma'}{' '}
                    <ArrowRight size={17} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="banner-circle" />
                  <BloubMood mood="feliz" />
                  <span className="banner-star">✦</span>
                </div>
              </section>
              <div className="stats">
                <div>
                  <span className="stat-icon sage">
                    <LayoutGrid size={20} />
                  </span>
                  <strong>
                    {data.classes.length}
                    <small>Turmas criadas</small>
                  </strong>
                </div>
                <div>
                  <span className="stat-icon peach">
                    <Users size={20} />
                  </span>
                  <strong>
                    {data.students.length}
                    <small>Alunos cadastrados</small>
                  </strong>
                </div>
                <div>
                  <span className="stat-icon blue">
                    <SlidersHorizontal size={20} />
                  </span>
                  <strong>
                    {totalProfiles}
                    <small>Perfis personalizados</small>
                  </strong>
                </div>
                <div>
                  <span className="stat-icon lilac">
                    <FileText size={20} />
                  </span>
                  <strong>
                    {data.exams.length}
                    <small>Provas preparadas</small>
                  </strong>
                </div>
              </div>
              <div className="section-heading">
                <h2 ref={classListHeading} tabIndex={-1}>
                  Suas turmas <span>{data.classes.length}</span>
                </h2>
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar turma"
                    placeholder="Buscar turma ou matéria…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="class-grid">
                {data.classes
                  .filter((c) =>
                    `${c.name} ${c.subject}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => {
                    const list = data.students.filter(
                        (s) => s.class_id === c.id,
                      ),
                      n = list.filter(
                        (s) => s.criteria || s.difficulties,
                      ).length;
                    return (
                      <button
                        key={c.id}
                        className="class-card"
                        onClick={() =>
                          startNavigation(() => {
                            setCurrent(c.id);
                            setSearch('');
                          })
                        }
                      >
                        <div className={`class-cover ${c.color}`}>
                          <span className="class-symbol">
                            <BookOpen size={28} strokeWidth={1.4} />
                          </span>
                          <span className="cover-decoration" aria-hidden="true">
                            {c.subject.toLowerCase().includes('mat')
                              ? '÷'
                              : '✳'}
                          </span>
                        </div>
                        <div className="class-content">
                          <span className="class-subject">{c.subject}</span>
                          <h3>{c.name}</h3>
                          <div className="class-count">
                            <Users size={15} />
                            {list.length}{' '}
                            {list.length === 1 ? 'aluno' : 'alunos'}
                            <span>•</span>
                            {c.grade}
                          </div>
                          <div className="profile-progress">
                            <span
                              style={{
                                width: `${list.length ? (n / list.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <p>
                            {n} de {list.length} perfis personalizados
                          </p>
                          <div className="class-footer">
                            <div className="avatar-stack">
                              {list.slice(0, 3).map((s) => (
                                <span key={s.id}>{initials(s.name)}</span>
                              ))}
                              {!list.length && <span>+</span>}
                            </div>
                            <span>
                              Ver turma <ArrowUpRight size={16} />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                <button
                  className="new-class-card"
                  onClick={() => open('class')}
                >
                  <span>
                    <Plus size={24} />
                  </span>
                  <strong>Uma nova turma</strong>
                  <p>
                    Abra espaço para
                    <br />
                    novas possibilidades.
                  </p>
                </button>
              </div>
              <div className="bottom-tip">
                <Leaf size={18} />
                <span>
                  Um bom começo: registre as dificuldades de cada aluno antes de
                  gerar a primeira prova.
                </span>
              </div>
            </>
          )}
          {view === 'classes' && active && (
            <>
              <button
                className="back-link"
                onClick={() => startNavigation(() => setCurrent(null))}
              >
                <ArrowLeft size={16} />
                Todas as turmas
              </button>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{active.subject}</span>
                  <h1>
                    {active.name}
                    <span>.</span>
                  </h1>
                  <p>
                    Conheça os caminhos e prepare o próximo passo de cada aluno.
                  </p>
                </div>
                <div className="actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(null);
                      open('student');
                    }}
                  >
                    <Plus size={17} />
                    Adicionar aluno
                  </button>
                  <button
                    className="button primary"
                    disabled={!students.length}
                    title={
                      !students.length
                        ? 'Adicione um aluno à turma primeiro'
                        : undefined
                    }
                    onClick={() => open('generate')}
                  >
                    <Sparkles size={17} />
                    Preparar provas
                  </button>
                </div>
              </div>
              <div className="class-summary">
                <span>
                  <Users size={18} />
                  <strong>{students.length}</strong> alunos
                </span>
                <span>
                  <SlidersHorizontal size={18} />
                  <strong>
                    {
                      students.filter((s) => s.criteria || s.difficulties)
                        .length
                    }
                  </strong>{' '}
                  perfis personalizados
                </span>
                <span>
                  <FileText size={18} />
                  <strong>
                    {data.exams.filter((e) => e.class_id === current).length}
                  </strong>{' '}
                  provas
                </span>
              </div>
              <div className="section-heading">
                <h2>Alunos da turma</h2>
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar aluno…"
                    aria-label="Buscar aluno"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {!students.length ? (
                <Empty
                  title="Vamos conhecer sua turma?"
                  text="Cadastre o primeiro aluno e registre o que ele precisa praticar."
                  action={
                    <button
                      className="button primary"
                      onClick={() => {
                        setEditing(null);
                        open('student');
                      }}
                    >
                      Adicionar aluno
                    </button>
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Dificuldades e objetivos</th>
                        <th>Nível</th>
                        <th>Perfil</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {students
                        .filter((s) =>
                          `${s.name} ${s.code}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div className="student-name">
                                <span className="avatar pastel">
                                  {initials(s.name)}
                                </span>
                                <span>
                                  <strong>{s.name}</strong>
                                  <small>{s.code}</small>
                                </span>
                              </div>
                            </td>
                            <td className="difficulty">
                              {s.difficulties || 'Ainda não informado'}
                            </td>
                            <td>
                              <span className="neutral-badge">{s.level}</span>
                            </td>
                            <td>
                              <span
                                className={`status ${s.difficulties || s.criteria ? 'good' : 'pending'}`}
                              >
                                {s.difficulties || s.criteria
                                  ? 'Personalizado'
                                  : 'A completar'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Editar ${s.name}`}
                                onClick={() => {
                                  setEditing(s);
                                  open('student');
                                }}
                              >
                                <Pencil size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {view === 'exams' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    DO PLANEJAMENTO À SALA DE AULA
                  </span>
                  <h1>
                    Minhas provas<span>.</span>
                  </h1>
                  <p>Revise com cuidado. Aprove e leve para seus alunos.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    navigate('classes');
                    if (!data.classes.length) open('class');
                  }}
                >
                  <Users size={18} />
                  {data.classes.length
                    ? 'Escolher uma turma'
                    : 'Criar primeira turma'}
                </button>
              </div>
              <div className="section-heading">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar provas"
                    placeholder="Buscar por aluno, matéria ou título…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelection([]);
                    }}
                  />
                </div>
                <span className="muted">
                  {approved.length} aprovadas ·{' '}
                  {data.exams.length - approved.length} em revisão
                </span>
              </div>
              {!!data.exams.length && (
                <div className="selection-bar">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        filteredExams.filter((e) => e.status === 'approved')
                          .length > 0 &&
                        filteredExams
                          .filter((e) => e.status === 'approved')
                          .every((e) => selection.includes(e.id))
                      }
                      onChange={(e) =>
                        setSelection(
                          e.target.checked
                            ? filteredExams
                                .filter((e) => e.status === 'approved')
                                .map((e) => e.id)
                            : [],
                        )
                      }
                    />
                    Selecionar todas as aprovadas
                  </label>
                  <span>{selection.length} selecionadas</span>
                  <select
                    aria-label="Formato de download"
                    value={format}
                    onChange={(e) =>
                      setFormat(e.target.value as 'pdf' | 'docx')
                    }
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                  </select>
                  <button
                    className="button secondary small-button"
                    disabled={!selection.length || busy}
                    onClick={() =>
                      void action(async () => {
                        await downloadExams(
                          data.exams.filter((e) => selection.includes(e.id)),
                          format,
                        );
                        setMessage('Download preparado.');
                      })
                    }
                  >
                    <Download size={16} />
                    Baixar {selection.length > 1 ? 'ZIP' : ''}
                  </button>
                </div>
              )}
              {!filteredExams.length ? (
                <Empty
                  title="Uma nova avaliação começa aqui"
                  text="Escolha uma turma e prepare provas com os critérios de cada aluno."
                />
              ) : (
                <div className="exam-list">
                  {filteredExams.map((e) => (
                    <div className="exam-row" key={e.id}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar prova de ${e.profile_snapshot.name}`}
                        disabled={e.status !== 'approved'}
                        checked={selection.includes(e.id)}
                        onChange={(v) =>
                          setSelection(
                            v.target.checked
                              ? [...selection, e.id]
                              : selection.filter((x) => x !== e.id),
                          )
                        }
                      />
                      <span className="file-icon">
                        <FileText size={23} />
                      </span>
                      <div className="exam-row-info">
                        <h3>{e.title}</h3>
                        <p>
                          {e.profile_snapshot.name} <span>·</span>{' '}
                          {data.classes.find((c) => c.id === e.class_id)?.name}{' '}
                          <span>·</span> {e.content.questions.length} questões
                        </p>
                      </div>
                      <span
                        className={`status ${e.status === 'approved' ? 'good' : 'pending'}`}
                      >
                        {e.status === 'approved' ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Clock size={13} />
                        )}{' '}
                        {e.status === 'approved' ? 'Aprovada' : 'Em revisão'}
                      </span>
                      <button
                        className="button secondary small-button"
                        onClick={() => {
                          setExam(structuredClone(e));
                          open('exam');
                        }}
                      >
                        Revisar <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="helper-note">
                <Printer size={16} /> As provas são respondidas em papel, na
                sala de aula. O gabarito fica separado.
              </p>
            </>
          )}
          {view === 'templates' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">O SEU JEITO DE AVALIAR</span>
                  <h1>
                    Modelos de prova<span>.</span>
                  </h1>
                  <p>
                    Guarde seus arquivos e as orientações que vão guiar cada
                    avaliação.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setTemplateText('');
                    open('template');
                  }}
                >
                  <Upload size={18} />
                  Enviar modelo
                </button>
              </div>
              <div className="notice soft">
                <BookOpen size={21} />
                <p>
                  A IA usa o conteúdo extraído do arquivo e suas orientações.
                  Revise o texto antes de gerar provas. PDFs digitalizados são
                  lidos por IA; imagens dentro de arquivos Word não são
                  extraídas. A diagramação de saída usa o modelo Provaai.
                </p>
              </div>
              <div className="template-grid">
                <div className="template-card">
                  <div className="mini-document">
                    <span />
                    <b>Prova individual</b>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <h3>Modelo Provaai</h3>
                  <p>A4 · Identificação · Espaço para respostas</p>
                  <span className="status good">Padrão incluído</span>
                </div>
                {data.templates.map((t) => (
                  <div className="template-card" key={t.id}>
                    <div className="template-file">
                      <FileText size={38} />
                      <span>{t.filename.split('.').pop()?.toUpperCase()}</span>
                    </div>
                    <h3>{t.name}</h3>
                    <p>{t.filename}</p>
                    <p className="muted">{t.reference_text.slice(0, 100)}</p>
                    <p>
                      {t.processing_status === 'ready'
                        ? 'Leitura concluída'
                        : t.processing_error || 'Leitura pendente'}
                    </p>
                    {!demo && (
                      <button
                        disabled={busy}
                        className="text-button"
                        onClick={() => void action(() => processTemplate(t.id))}
                      >
                        Ler arquivo novamente
                      </button>
                    )}
                    {t.extracted_text && (
                      <details>
                        <summary>Revisar texto extraído</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void action(async () => {
                              const { error } = await supabase
                                .from('sala_templates')
                                .update({
                                  extracted_text: String(f.get('text')),
                                })
                                .eq('id', t.id);
                              if (error) throw error;
                              await load();
                              setMessage('Texto revisado salvo.');
                            });
                          }}
                        >
                          <textarea
                            name="text"
                            rows={12}
                            defaultValue={t.extracted_text}
                            maxLength={60000}
                            required
                          />
                          <button className="button secondary" disabled={busy}>
                            Salvar revisão
                          </button>
                        </form>
                      </details>
                    )}
                    {!demo && (
                      <button
                        className="text-button"
                        onClick={() =>
                          void action(async () => {
                            const { data: s, error } = await supabase.storage
                              .from('sala-templates')
                              .createSignedUrl(t.path, 60);
                            if (error) throw error;
                            window.open(s.signedUrl, '_blank', 'noopener');
                          })
                        }
                      >
                        Abrir original <ArrowUpRight size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {view === 'settings' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">TUDO NO SEU LUGAR</span>
                  <h1>
                    Ajustes<span>.</span>
                  </h1>
                  <p>Conexões e próximos passos do seu espaço.</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="settings-card">
                  <span className="stat-icon peach">
                    <Sparkles size={21} />
                  </span>
                  <h2>Geração por IA</h2>
                  <span className={`status ${ai ? 'good' : 'pending'}`}>
                    {ai
                      ? 'Chave configurada no servidor'
                      : 'Configuração pendente'}
                  </span>
                  <p>
                    A IA usa a matéria e os critérios pedagógicos para preparar
                    um rascunho. A revisão e a aprovação são sempre suas.
                  </p>
                  <p className="helper-note">
                    Não informe nomes, diagnósticos ou outros dados pessoais nos
                    critérios enviados à IA. A camada gratuita do provedor tem
                    cotas.
                  </p>
                </section>
                <section className="settings-card">
                  <h2>Sobre esta primeira versão</h2>
                  <p>
                    Turmas, alunos, perfis, rascunhos, revisão e downloads. O
                    acesso é individual por professor. Não há contas de alunos.
                  </p>
                  <p>
                    A geração ocorre uma prova por vez. OCR, conversão fiel de
                    modelos, fila durável e verificação semântica de
                    exclusividade são evoluções pendentes.
                  </p>
                  {demo && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setData(demoData());
                        setMessage('Demonstração restaurada.');
                      }}
                    >
                      Restaurar dados fictícios
                    </button>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            Provaai. <span>Feita para quem ensina.</span>
          </span>
          <span>Um aluno por vez. Uma possibilidade a mais.</span>
        </footer>
      </div>
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {message}
          <button onClick={() => setMessage('')} aria-label="Fechar">
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          title={
            modal === 'class'
              ? 'Uma nova turma'
              : modal === 'student'
                ? editing
                  ? 'Perfil do aluno'
                  : 'Conheça mais um aluno'
                : modal === 'generate'
                  ? 'Preparar provas individuais'
                  : modal === 'template'
                    ? 'Seu modelo de referência'
                    : 'Revisar prova'
          }
          wide={modal === 'exam' || modal === 'generate'}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === 'class' && (
            <form onSubmit={saveClass}>
              <p className="muted">
                Comece pela turma. Depois, cada aluno ganha seu espaço.
              </p>
              <Field label="Nome da turma">
                <input
                  name="name"
                  placeholder="Ex.: 7º ano A"
                  required
                  maxLength={80}
                />
              </Field>
              <div className="form-grid">
                <Field label="Série / etapa">
                  <input
                    name="grade"
                    placeholder="Ex.: 7º ano"
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Matéria">
                  <input
                    name="subject"
                    placeholder="Ex.: Matemática"
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Cor da turma">
                  <select name="color">
                    <option value="sage">Verde sálvia</option>
                    <option value="peach">Pêssego</option>
                    <option value="blue">Azul</option>
                    <option value="lilac">Lilás</option>
                  </select>
                </Field>
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? 'Salvando…' : 'Criar turma'}
                  <Plus size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'student' && (
            <form onSubmit={saveStudent}>
              <p className="muted">
                {active?.name} · {active?.subject}. Os critérios ficam
                vinculados ao aluno nesta turma.
              </p>
              <Field label="Nome do aluno">
                <input
                  name="name"
                  defaultValue={editing?.name}
                  placeholder="Nome completo"
                  required
                  maxLength={100}
                />
              </Field>
              <div className="form-grid">
                <Field label="Código na turma">
                  <input
                    name="code"
                    defaultValue={editing?.code}
                    placeholder="Ex.: A008"
                    required
                    maxLength={30}
                  />
                </Field>
                <Field label="Nível atual">
                  <select
                    name="level"
                    defaultValue={editing?.level || 'Intermediário'}
                  >
                    <option>Em desenvolvimento</option>
                    <option>Intermediário</option>
                    <option>Avançado</option>
                  </select>
                </Field>
              </div>
              <Field label="Dificuldades e objetivos de aprendizagem">
                <textarea
                  name="difficulties"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editing?.difficulties}
                  placeholder="Ex.: Somar frações com denominadores diferentes."
                />
              </Field>
              <Field label="Critérios específicos para as provas">
                <textarea
                  name="criteria"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editing?.criteria}
                  placeholder="Ex.: Enunciados curtos, exemplos do cotidiano e mais espaço para cálculos."
                />
              </Field>
              <p className="helper-note">
                Descreva necessidades pedagógicas. Evite diagnósticos e
                informações pessoais nos critérios.
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar perfil'}
                  <Check size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'generate' && active && (
            <form onSubmit={createExams}>
              <p className="muted">
                Uma prova por aluno, orientada pelo que ele precisa aprender.
              </p>
              <div className="form-grid">
                <Field label="Turma">
                  <input
                    readOnly
                    value={active.name + ' · ' + active.subject}
                  />
                </Field>
                <Field label="Título da avaliação">
                  <input
                    name="title"
                    placeholder="Ex.: Frações no cotidiano"
                    required
                    maxLength={120}
                  />
                </Field>
              </div>
              <Field label="Matérias, tópicos e objetivos">
                <textarea
                  name="topics"
                  rows={2}
                  placeholder="Ex.: Frações equivalentes, adição e subtração. Aplicar conceitos em problemas do cotidiano."
                  required
                  maxLength={3000}
                />
              </Field>
              <QuestionCounts />
              <Field label="Modelo de referência">
                <select name="template_id">
                  <option value="">Modelo Provaai · padrão</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <h3>Quem vai receber a prova?</h3>
              <div className="student-picks" key={current}>
                {students.map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      name="student"
                      value={s.id}
                      defaultChecked
                    />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.difficulties ||
                          s.criteria ||
                          'Usar os critérios gerais da turma'}
                      </small>
                    </span>
                  </label>
                ))}
                {!students.length && (
                  <p>
                    Cadastre alunos nesta turma antes de preparar as provas.
                  </p>
                )}
              </div>
              <div className="form-grid">
                <Field label="Como preparar">
                  <select name="mode" defaultValue={demo ? 'manual' : 'ai'}>
                    <option value="ai" disabled={demo}>
                      Gerar rascunhos com IA
                    </option>
                    <option value="manual">
                      Criar rascunhos e escrever questões
                    </option>
                  </select>
                </Field>
                <p className="helper-note">
                  Você revisará todas as questões antes da impressão. Critérios
                  individuais podem mudar a dificuldade.
                </p>
              </div>
              {progress && (
                <div className="notice">
                  <Loader2 className="spin" size={17} />
                  {progress}
                </div>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={busy || !students.length}
                >
                  {busy ? 'Preparando…' : 'Preparar provas'}
                  <Sparkles size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'template' && (
            <form onSubmit={uploadTemplate}>
              <Field label="Nome do modelo">
                <input
                  name="name"
                  placeholder="Ex.: Avaliação bimestral"
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Arquivo PDF, DOC ou DOCX · até 20 MB">
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.doc,.docx"
                  required
                />
              </Field>
              <Field label="Orientações adicionais (opcional)">
                <textarea
                  rows={6}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  maxLength={12000}
                  placeholder="Indique orientações adicionais. O conteúdo será lido do arquivo."
                />
              </Field>
              <p className="helper-note">
                O arquivo será lido automaticamente. PDFs são enviados ao
                provedor de IA para leitura, inclusive páginas digitalizadas.
                Remova dados pessoais antes de enviar. Revise a extração; a
                diagramação final usa o modelo Provaai.
              </p>
              <div className="dialog-actions">
                <button className="button primary" disabled={busy}>
                  {busy ? 'Enviando…' : 'Salvar modelo'}
                  <Upload size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'exam' && exam && (
            <div className="exam-editor">
              <div className="editor-summary">
                <span className="avatar pastel">
                  {initials(exam.profile_snapshot.name)}
                </span>
                <div>
                  <strong>{exam.profile_snapshot.name}</strong>
                  <small>
                    {exam.subject} · {exam.profile_snapshot.code}
                  </small>
                </div>
                <span
                  className={`status ${exam.status === 'approved' ? 'good' : 'pending'}`}
                >
                  {exam.status === 'approved' ? 'Aprovada' : 'Em revisão'}
                </span>
              </div>
              <Field label="Título">
                <input
                  value={exam.title}
                  maxLength={120}
                  onChange={(e) =>
                    setExam({ ...exam, title: e.target.value, status: 'draft' })
                  }
                />
              </Field>
              <Field label="Instruções ao aluno">
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={exam.content.instructions}
                  onChange={(e) =>
                    setExam({
                      ...exam,
                      status: 'draft',
                      content: {
                        ...exam.content,
                        instructions: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              {!demo && !exam.content.questions.length && (
                <QuestionCounts
                  fixedTotal={exam.question_count}
                  objectives={exam.content.objectiveCount}
                  onChange={(objectiveCount) =>
                    setExam({
                      ...exam,
                      content: { ...exam.content, objectiveCount },
                    })
                  }
                />
              )}
              {exam.content.questions.map((q, i) => (
                <section className="question-editor" key={i}>
                  <div className="question-top">
                    <strong>Questão {i + 1}</strong>
                    <button
                      className="icon-button"
                      aria-label={`Remover questão ${i + 1}`}
                      onClick={() =>
                        setExam({
                          ...exam,
                          status: 'draft',
                          content: {
                            ...exam.content,
                            questions: exam.content.questions.filter(
                              (_, j) => i !== j,
                            ),
                          },
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <Field label="Enunciado">
                    <textarea
                      rows={3}
                      value={q.statement}
                      maxLength={3000}
                      onChange={(e) =>
                        setExam({
                          ...exam,
                          status: 'draft',
                          content: {
                            ...exam.content,
                            questions: exam.content.questions.map((x, j) =>
                              i === j ? { ...x, statement: e.target.value } : x,
                            ),
                          },
                        })
                      }
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Habilidade / objetivo">
                      <input
                        value={q.objective}
                        maxLength={500}
                        onChange={(e) =>
                          setExam({
                            ...exam,
                            status: 'draft',
                            content: {
                              ...exam.content,
                              questions: exam.content.questions.map((x, j) =>
                                i === j
                                  ? { ...x, objective: e.target.value }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label="Pontos">
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.1}
                        value={q.points}
                        onChange={(e) =>
                          setExam({
                            ...exam,
                            status: 'draft',
                            content: {
                              ...exam.content,
                              questions: exam.content.questions.map((x, j) =>
                                i === j
                                  ? { ...x, points: Number(e.target.value) }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                  </div>
                  {q.options.map((o, k) => (
                    <Field
                      key={k}
                      label={`Alternativa ${String.fromCharCode(65 + k)}`}
                    >
                      <input
                        value={o}
                        maxLength={500}
                        onChange={(e) =>
                          setExam({
                            ...exam,
                            status: 'draft',
                            content: {
                              ...exam.content,
                              questions: exam.content.questions.map((x, j) =>
                                i === j
                                  ? {
                                      ...x,
                                      answer:
                                        x.answer === o
                                          ? e.target.value
                                          : x.answer,
                                      options: x.options.map((v, l) =>
                                        l === k ? e.target.value : v,
                                      ),
                                    }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                  <Field label="Resposta esperada · apenas para o professor">
                    {q.type === 'objective' ? (
                      <select
                        value={q.answer}
                        onChange={(e) =>
                          setExam({
                            ...exam,
                            status: 'draft',
                            content: {
                              ...exam.content,
                              questions: exam.content.questions.map((x, j) =>
                                i === j ? { ...x, answer: e.target.value } : x,
                              ),
                            },
                          })
                        }
                      >
                        {q.options.map((o, k) => (
                          <option key={k}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        rows={2}
                        maxLength={3000}
                        value={q.answer}
                        onChange={(e) =>
                          setExam({
                            ...exam,
                            status: 'draft',
                            content: {
                              ...exam.content,
                              questions: exam.content.questions.map((x, j) =>
                                i === j ? { ...x, answer: e.target.value } : x,
                              ),
                            },
                          })
                        }
                      />
                    )}
                  </Field>
                </section>
              ))}
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={exam.content.questions.length >= 30}
                  onClick={() =>
                    setExam({
                      ...exam,
                      status: 'draft',
                      content: {
                        ...exam.content,
                        questions: [
                          ...exam.content.questions,
                          {
                            statement: '',
                            type: 'essay',
                            options: [],
                            answer: '',
                            objective: '',
                            points: 1,
                          },
                        ],
                      },
                    })
                  }
                >
                  <Plus size={16} />
                  Questão discursiva
                </button>
                {!demo && !exam.content.questions.length && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        setExam(await generateOne(exam));
                        await load();
                        setMessage('Rascunho gerado. Revise as questões.');
                      })
                    }
                  >
                    <Sparkles size={16} />
                    Gerar com IA
                  </button>
                )}
              </div>
              <p className="helper-note">
                Confira correção, adequação e diferenças entre alunos. A
                verificação automática atual detecta repetições exatas; a
                revisão de semelhanças é docente.
              </p>
              <div className="dialog-actions wrap">
                {exam.status === 'approved' ? (
                  <>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await downloadExams([exam], 'pdf', true);
                        })
                      }
                    >
                      Gabarito
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await downloadExams([exam], 'docx');
                        })
                      }
                    >
                      DOCX <Download size={16} />
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await downloadExams([exam], 'pdf');
                        })
                      }
                    >
                      Baixar PDF <Download size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void saveExam()}
                    >
                      Salvar rascunho
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => void saveExam(true)}
                    >
                      <CheckCircle2 size={17} />
                      Revisei e aprovo
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
