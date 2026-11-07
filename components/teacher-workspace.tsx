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
  Leaf,
  AlertCircle,
  Pencil,
  Trash2,
} from './animated-icons';
import { supabase } from '@/lib/supabase';
import { nextStudentCode, saveWithStudentCode } from '@/lib/student-code';
import ExamLibrary from './exam-library';
import RecoveryWorkspace from './recovery-workspace';
import QuestionCounts from './question-counts';
import TemplateFilePicker from './template-file-picker';
import { useTemplateQueue } from './use-template-queue';
import { useExamBatch } from './use-exam-batch';
import { useExamDownload } from './use-exam-download';
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
import StudentsWorkspace from './students-workspace';
import CopySharing, { ShareCopyForm } from './copy-sharing';
import { ClassIcon } from './class-icon';
import { ClassCover } from './class-cover';
import ClassSettings, { type BannerDraft } from './class-settings';
import WorkspaceHeader from './workspace-header';
import { classColor } from '@/lib/class-appearance';
import { useWorkspaceHistory } from './use-workspace-history';
import { classExpired, deletionDate, type CopyInvitation, type ShareTarget } from '@/lib/classroom';
type Modal = 'class' | 'edit-class' | 'delete-class' | 'reactivate' | 'share' | 'student' | 'generate' | 'template' | 'uploads' | 'downloads' | 'exam' | null;
const uploadStages = { queued: 'Na fila', uploading: 'Enviando arquivo', reading: 'Lendo conteúdo', ready: 'Pronto', failed: 'Não concluído' };
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
  { id: 'students', short: 'Alunos', name: 'Alunos', icon: Users },
  { id: 'exams', short: 'Provas coletivas', name: 'Provas coletivas', icon: FileText },
  { id: 'recovery', short: 'Provas individuais', name: 'Provas individuais', icon: GraduationCap },
  {
    id: 'templates',
    short: 'Modelos',
    name: 'Modelos de prova',
    icon: FolderOpen,
  },
  { id: 'settings', short: 'Ajustes', name: 'Ajustes', icon: Settings },
  { id: 'sharing', short: 'Compartilhamentos', name: 'Compartilhamentos', icon: ArrowUpRight },
];

export default function TeacherWorkspace({
  user,
  demo,
  leaveDemo,
  onPendingChange,
  onWorkChange,
  startNavigation,
}: {
  user: Teacher | null;
  demo: boolean;
  leaveDemo: () => void;
  onPendingChange: (pending: boolean) => void;
  onWorkChange: (working: boolean) => void;
  startNavigation: (change: () => void) => void;
}) {
  const [data, setData] = useState<DataSet>(() => (demo ? demoData() : empty)),
    [teacherTemplate, setTeacherTemplate] = useState<string | null>(null),
    [view, setView] = useState('classes'),
    [current, setCurrent] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [modal, setModal] = useState<Modal>(null),
    [editing, setEditing] = useState<Student | null>(null),
    [generatedStudentCode, setGeneratedStudentCode] = useState(''),
    [studentCodePending, setStudentCodePending] = useState(false),
    [exam, setExam] = useState<Exam | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dbError, setDbError] = useState(''),
    [recoveryMembers, setRecoveryMembers] = useState<string[]>([]),
    [recoveryStudent, setRecoveryStudent] = useState<Student | null>(null),
    [showArchived, setShowArchived] = useState(false),
    [ai, setAi] = useState(false),
    [mobile, setMobile] = useState(false),
    [progress, setProgress] = useState(''),
    [templateText, setTemplateText] = useState(''),
    [templateFiles, setTemplateFiles] = useState<File[]>([]),
    [generationChoice, setGenerationChoice] = useState('inherit');
  const [classStatus, setClassStatus] = useState('active');
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [invitations, setInvitations] = useState<CopyInvitation[]>([]);
  const active = data.classes.find((c) => c.id === current),
    students = data.students.filter((s) => s.class_id === current && !s.archived_at),
    totalProfiles = data.students.filter(
      (s) => !s.archived_at && (s.difficulties || s.criteria),
    ).length;
  const classListHeading = useRef<HTMLHeadingElement>(null);
  async function readStudentCodes(classId: string): Promise<string[]> {
    if (demo) return data.students.filter(student => student.class_id === classId).map(student => student.code);
    if (!user) throw new Error('Entre novamente para cadastrar o aluno.');
    const codes: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await supabase.from('sala_students')
        .select('code').eq('class_id', classId).eq('user_id', user.id)
        .order('id').range(offset, offset + 999);
      if (error) throw error;
      codes.push(...rows.map(row => row.code as string));
      if (rows.length < 1000) return codes;
    }
  }
  useEffect(() => {
    if (modal !== 'student' || editing || !current) return;
    let cancelled = false;
    setStudentCodePending(true);
    readStudentCodes(current).then(codes => {
      if (!cancelled) setGeneratedStudentCode(nextStudentCode(codes));
    }).catch(error => {
      if (!cancelled) { setGeneratedStudentCode(''); setError(cleanError(error)); }
    }).finally(() => { if (!cancelled) setStudentCodePending(false); });
    return () => { cancelled = true; };
  }, [modal, current, editing?.id, user?.id, demo]);
  const [initialLoad, setInitialLoad] = useState(!demo);
  const [configPending, setConfigPending] = useState(true);
  useWorkspaceHistory(user?.id ?? 'demo', {
    view, current, modal, student: modal === 'student' || modal === 'reactivate' ? editing?.id ?? null : null,
    exam: modal === 'exam' ? exam?.id ?? null : null,
    recovery: modal === 'generate' ? recoveryStudent?.id ?? null : null,
    share: modal === 'share' && shareTarget ? `${shareTarget.kind}:${shareTarget.id}` : null,
  }, location => {
    setView(sections.some(section => section.id === location.view) ? location.view : 'classes');
    setCurrent(location.current);
    setEditing(data.students.find(item => item.id === location.student) ?? null);
    setExam(data.exams.find(item => item.id === location.exam) ?? null);
    setRecoveryStudent(data.students.find(item => item.id === location.recovery) ?? null);
    const [kind, id] = location.share?.split(':') ?? [];
    const resource = (kind === 'class' ? data.classes : data.students).find(item => item.id === id);
    setShareTarget(resource ? { kind: kind as 'class' | 'student', id, name: resource.name } : null);
    const missing = (location.modal === 'exam' && !data.exams.some(item => item.id === location.exam)) ||
      (['edit-class', 'delete-class', 'generate'].includes(location.modal ?? '') && !data.classes.some(item => item.id === location.current)) ||
      (location.modal === 'share' && !resource) ||
      (location.modal === 'reactivate' && !data.students.some(item => item.id === location.student));
    setModal(missing ? null : location.modal as Modal);
    setSearch(''); setError(''); setMobile(false);
  }, !initialLoad);
  const screenPending = initialLoad || (view === 'settings' && configPending);
  useLayoutEffect(() => {
    onPendingChange(screenPending);
    return () => onPendingChange(false);
  }, [screenPending, onPendingChange]);
  const downloads = useExamDownload();
  const uploads = useTemplateQueue();
  const uploading = uploads.active.length > 0;
  const uploadFailed = uploads.tasks.some(task => task.stage === 'failed');
  useEffect(() => {
    if (!uploads.tasks.length || uploading || uploadFailed) return;
    setModal(current => current === 'uploads' ? null : current);
    setMessage(uploads.tasks.length === 1 ? 'Modelo pronto para usar.' : 'Modelos prontos para usar.');
    uploads.dismiss();
  }, [uploads.tasks, uploading, uploadFailed]);
  const approved = data.exams.filter((e) => e.status === 'approved');
  async function exportExams(exams: Exam[], format: 'pdf'|'docx', answerKey=false, report: (completed: number) => void = () => {}) {
    if (demo) return downloadExams(exams,format,answerKey,undefined,report);
    const {data:{session}}=await supabase.auth.getSession();
    if (!session) throw new Error('Entre novamente para exportar a prova.');
    await downloadExams(exams,format,answerKey,async (exam,format,answerKey)=>{
      const response=await fetch('/api/export/exam',{method:'POST',headers:{
        authorization:'Bearer '+session.access_token,'content-type':'application/json',
      },body:JSON.stringify({id:exam.id,format,answerKey}), signal: AbortSignal.timeout(160_000)}).catch(error => {
        if (error?.name === 'TimeoutError') throw new Error('O download demorou mais que o esperado. Tente novamente ou baixe em DOCX.');
        throw error;
      });
      if (!response.ok) {
        const body=await response.json().catch(()=>({}));
        throw new Error(body.error || 'Não foi possível baixar a prova. Tente novamente.');
      }
      return response.blob();
    },report);
  }
  function startDownload(items: Exam[], format: 'pdf'|'docx', answerKey = false) {
    if (busy || downloads.running.current || generation.busy) return;
    const snapshot = structuredClone(items);
    setError('');
    setModal('downloads');
    void downloads.start(snapshot.length, report => exportExams(snapshot, format, answerKey, report));
  }
  async function load(includeTemplates = false) {
    if (!user) return;
    const tables = ['sala_classes', 'sala_students', 'sala_exams', 'sala_recovery_students'];
    if (includeTemplates) tables.push('sala_templates');
    const [results, preference] = await Promise.all([
      Promise.all(tables.map(table => supabase.from(table).select('*')
        .order('created_at', { ascending: false }).limit(1000))),
      supabase.from('sala_teacher_template_defaults').select('template_id')
        .eq('user_id', user.id).maybeSingle(),
    ]);
    const failed = [preference, ...results].find((r) => r.error);
    if (failed) {
      setDbError(cleanError(failed.error));
      return;
    }
    setDbError('');
    setRecoveryMembers((results[3].data as {student_id:string}[]).map(row => row.student_id));
    setTeacherTemplate(preference.data?.template_id ?? null);
    setData(previous => ({
      classes: results[0].data as ClassRoom[],
      students: results[1].data as Student[],
      exams: results[2].data as Exam[],
      templates: includeTemplates ? results[4].data as Template[] : previous.templates,
    }));
    await loadInvitations();
  }
  async function loadInvitations() {
    if (!user || demo) return;
    const { data: rows, error } = await supabase.from('sala_copy_invitations')
      .select('id,owner_id,sender_email,recipient_email,kind,resource_name,student_count,created_at,accepted_at,revoked_at')
      .order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    setInvitations(rows as CopyInvitation[]);
  }
  useEffect(() => {
    if (view === 'sharing' && user && !demo) void loadInvitations().catch(error => setError(cleanError(error)));
  }, [view, user?.id, demo]);
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json() as Promise<{ aiConfigured: boolean }>)
      .then((v) => setAi(v.aiConfigured))
      .catch(() => {})
      .finally(() => setConfigPending(false));
  }, []);
  const userId = user?.id;
  const generation = useExamBatch(userId, async () => {
    const {data: exams,error} = await supabase.from('sala_exams').select('*')
      .order('created_at',{ascending:false}).limit(1000);
    if (error) throw error;
    setData(previous => ({...previous,exams:exams as Exam[]}));
  });
  const workInProgress = busy || uploading || downloads.busy || generation.busy;
  useEffect(() => { onWorkChange(workInProgress); }, [workInProgress, onWorkChange]);
  useEffect(() => () => onWorkChange(false), [onWorkChange]);
  useEffect(() => {
    if (!userId || demo) return;
    let mounted = true;
    load(true)
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
      setRecoveryStudent(null);
      setShowArchived(false);
      setMobile(false);
      setModal(null);
    });
  }
  function open(m: Modal) {
    setError('');
    if (m === 'generate' && active?.archived_at) { setError('Reative a turma antes de preparar provas.'); return; }
    if (m === 'student') {
      setGeneratedStudentCode(nextStudentCode(data.students.filter(student => student.class_id === current).map(student => student.code)));
      setStudentCodePending(!demo);
    }
    if (m === 'generate' && downloads.running.current) return;
    if (m === 'generate') {setGenerationChoice(classTemplateChoice);setRecoveryStudent(null);}
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
              r.id === value.id ? { ...r, ...value } : r,
            )
          : [value, ...d[kind]],
      }));
      return value;
    }
    let query = update
      ? supabase.from(table).update(Object.fromEntries(Object.entries(value).filter(([key]) => !['id','user_id','created_at'].includes(key)))).eq('id', value.id)
      : supabase.from(table).insert(value);
    const { data: saved, error } = await query.select().single();
    if (error) throw error;
    await load();
    return saved;
  }
  const uid = demo ? 'demo' : user?.id;
  const now = () => new Date().toISOString();
  const teacherTemplateName = teacherTemplate
    ? data.templates.find(t => t.id === teacherTemplate)?.name ?? 'Modelo salvo'
    : 'Modelo Provaai';
  const classTemplateChoice = active?.template_override_id ?? (active?.use_provaai_template ? 'builtin' : 'inherit');
  const generationTemplate = generationChoice === 'inherit' ? teacherTemplate
    : generationChoice === 'builtin' ? null : generationChoice;
  function templateReady(id: string | null | undefined) {
    return !id || (!uploads.active.some(t => t.id === id) &&
      data.templates.some(t => t.id === id && t.processing_status === 'ready'));
  }

  async function setDefaultTemplate(id: string | null) {
    if (!demo) {
      const { error } = await supabase.from('sala_teacher_template_defaults')
        .upsert({ user_id: uid, template_id: id }, { onConflict: 'user_id' });
      if (error) throw error;
    }
    setTeacherTemplate(id);
    setMessage('Modelo padrão atualizado.');
  }
  function defaultControl(id: string | null, ready = true) {
    if (id === teacherTemplate)
      return <span className="status good"><Check size={14} /> Meu padrão</span>;
    return <button type="button" className="button secondary" disabled={busy || !ready}
      onClick={() => void action(() => setDefaultTemplate(id))}>Definir como padrão</button>;
  }
  async function saveClass(form: Record<string, FormDataEntryValue>, banner: BannerDraft) {
    await action(async () => {
      const parsed = classSchema.safeParse(form);
      if (!parsed.success)
        throw new Error('Preencha nome, série e matéria da turma.');
      const updating = modal === 'edit-class';
      if (updating && !active) throw new Error('Turma não encontrada.');
      const id = updating ? active!.id : crypto.randomUUID();
      let bannerPath = banner.path;
      let uploadedPath: string | null = null;
      if (banner.file) {
        if (demo) {
          bannerPath = await new Promise<string>((resolve,reject)=>{
            const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Não foi possível preparar a foto.'));reader.readAsDataURL(banner.file!);
          });
        } else {
          uploadedPath = `${uid}/${id}/${crypto.randomUUID()}.jpg`;
          const {error}=await supabase.storage.from('class-banners').upload(uploadedPath,banner.file,{contentType:'image/jpeg',upsert:false});
          if(error)throw new Error('Não foi possível enviar a foto. Tente novamente.');
          bannerPath=uploadedPath;
        }
      }
      const appearance={...parsed.data,banner_path:bannerPath,banner_crop:banner.crop};
      let saved: ClassRoom;
      try {
        if(demo) saved={...(updating?active!:{}),...appearance,id,user_id:uid!,created_at:updating?active!.created_at:now()};
        else {
          const query=updating
            ? supabase.from('sala_classes').update(appearance).eq('id',id).eq('user_id',uid!)
            : supabase.from('sala_classes').insert({...appearance,id,user_id:uid});
          const {data:result,error}=await query.select().single();
          if(error)throw error;saved=result as ClassRoom;
        }
      } catch(error) {
        if(uploadedPath)await supabase.storage.from('class-banners').remove([uploadedPath]);
        throw error;
      }
      setData(previous=>({...previous,classes:updating?previous.classes.map(room=>room.id===id?saved:room):[saved,...previous.classes]}));
      if(!demo&&active?.banner_path&&active.banner_path!==bannerPath&&updating) {
        // Uma falha de limpeza não invalida a turma que já foi salva.
        void supabase.storage.from('class-banners').remove([active.banner_path]).catch(()=>{});
      }
      navigate('classes');
      setCurrent(id);
      setModal(null);
      setMessage(updating ? 'Configurações da turma salvas.' : 'Turma criada. Agora você pode cadastrar os alunos.');
    });
  }
  async function saveStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      if (!current) throw new Error('Abra uma turma para cadastrar o aluno.');
      if (!editing && active?.archived_at) throw new Error('Reative a turma antes de adicionar alunos.');
      if (!editing && (studentCodePending || !generatedStudentCode)) {
        throw new Error('Aguarde a confirmação do código automático.');
      }
      const parsed = studentSchema.safeParse({ ...form, code: editing?.code || generatedStudentCode });
      if (!parsed.success)
        throw new Error('Confira os campos do aluno e o tamanho dos textos.');
      const record = {
          ...(editing ?? {}),
          ...parsed.data,
          id: editing?.id || crypto.randomUUID(),
          class_id: current,
          user_id: uid,
          created_at: editing?.created_at || now(),
      };
      let savedCode = editing?.code;
      if (editing) {
        await persist('students', 'sala_students', record, true);
      } else {
        const saved = await saveWithStudentCode(generatedStudentCode,
          () => readStudentCodes(record.class_id),
          async code => {
            if (demo) return { ...record, code };
            const { data: student, error } = await supabase.from('sala_students')
              .insert({ ...record, code }).select().single();
            if (error) throw error;
            return student as Student;
          });
        savedCode = saved.code;
        setData(previous => ({ ...previous, students: [saved.student as Student, ...previous.students] }));
      }
      setModal(null);
      setMessage(editing ? 'Perfil do aluno salvo.' : `Aluno cadastrado com o código ${savedCode}.`);
    });
  }
  async function createExams(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const room = active;
      if (!room)
        throw new Error('Abra uma turma para preparar as provas.');
      const ids = new Set(recoveryStudent ? [recoveryStudent.id] : f.getAll('student').map(String));
      const purpose = recoveryStudent ? 'recovery' : 'regular';
      if (recoveryStudent && !recoveryMembers.includes(recoveryStudent.id)) throw new Error('Adicione o aluno a Provas individuais primeiro.');
      const selected = students.filter((student) => ids.has(student.id));
      if (!selected.length || selected.length !== ids.size)
        throw new Error('Selecione pelo menos um aluno desta turma.');
      const title = String(f.get('title')).trim(),
        subject = String(f.get('subject') ?? '').trim(),
        topics = String(f.get('topics')).trim(),
        count = Number(f.get('count'));
      if (!title || !subject || subject.length > 80 || !topics || count < 1 || count > 30)
        throw new Error('Informe título, matéria, tópicos e de 1 a 30 questões.');
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
      const choice = String(f.get('template_choice'));
      const templateId = choice === 'inherit' ? teacherTemplate : choice === 'builtin' ? null : choice;
      if (!templateReady(templateId))
        throw new Error('Escolha um modelo com leitura concluída antes de preparar as provas.');
      if (generation.busy) throw new Error('Aguarde o lote de provas em andamento.');
      if (downloads.running.current) throw new Error('Aguarde o download terminar antes de gerar outras provas.');
      if (aiMode) {
        await generation.start({classId:room.id,students:[...ids],title,subject,topics,count,objectiveCount,choice,purpose});
        if (!recoveryStudent) setData(d => ({...d,classes:d.classes.map(c => c.id===room.id ? {...c,
          template_override_id:choice==='inherit'||choice==='builtin'?null:choice,
          use_provaai_template:choice==='builtin'} : c)}));
        setModal(null);
        return;
      }
      if (!recoveryStudent && choice !== classTemplateChoice) {
        const preference = {
          template_override_id: choice === 'inherit' || choice === 'builtin' ? null : choice,
          use_provaai_template: choice === 'builtin',
        };
        if (!demo) {
          const { error } = await supabase.from('sala_classes').update(preference)
            .eq('id', room.id).eq('user_id', uid).select('id').single();
          if (error) throw error;
        }
        setData(d => ({ ...d, classes: d.classes.map(c => c.id === room.id ? { ...c, ...preference } : c) }));
      }
      for (let i = 0; i < selected.length; i++) {
        const s = selected[i];
        setProgress(`Preparando ${i + 1} de ${selected.length}: ${s.name}`);
        const item: Exam = {
          id: crypto.randomUUID(),
          user_id: uid!,
          class_id: room.id,
          student_id: s.id,
          purpose,
          title,
          subject,
          topics,
          question_count: count,
          template_id: templateId,
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
      }
      if (!demo) await load();
      setProgress('');
      setModal(null);
      if (!recoveryStudent) {setView('exams');setSearch('');}
      else setView('recovery');
      setMessage('Provas criadas. Revise o conteúdo antes de aprovar.');
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
  function mergeTemplate(template: Template) {
    setData(previous => ({
      ...previous,
      templates: previous.templates.some(t => t.id === template.id)
        ? previous.templates.map(t => t.id === template.id ? template : t)
        : [template, ...previous.templates],
    }));
  }
  async function processTemplate(id: string, signal: AbortSignal) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    signal.throwIfAborted();
    if (!session || session.user.id !== uid) throw new Error('Entre novamente para ler o arquivo.');
    const r = await fetch('/api/template/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (session?.access_token || ''),
      },
      body: JSON.stringify({ templateId: id }),
      signal,
    });
    const result = (await r.json()) as { template?: Template; error?: { message: string } };
    if (!r.ok || result.template?.id !== id || result.template.processing_status !== 'ready')
      throw new Error(result.error?.message || 'Falha ao ler o modelo.');
    mergeTemplate(result.template);
  }
  async function readSavedTemplate(id: string, signal: AbortSignal) {
    try {
      await processTemplate(id, signal);
    } catch (err) {
      signal.throwIfAborted();
      const reason = cleanError(err);
      setData(d => ({ ...d, templates: d.templates.map(t => t.id === id
        ? { ...t, processing_status: 'error', processing_error: reason } : t) }));
      throw new Error(`Arquivo salvo. ${reason} Use “Ler arquivo novamente” em Modelos.`);
    }
  }
  function uploadTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const names = f.getAll('template_name').map(value => String(value).trim());
    if (!templateFiles.length || templateFiles.some((_, index) => !names[index])) {
      setError('Selecione um arquivo e informe um nome para cada modelo.');
      return;
    }
    uploads.enqueue(templateFiles.map((file, index) => {
      const id = crypto.randomUUID();
      const name = names[index];
      return { id, name, run: async (report, signal) => {
        report('uploading');
        await validateTemplateFile(file);
        signal.throwIfAborted();
        await storeTemplateFile(id, file, name, signal);
        if (!demo) {
          report('reading');
          await readSavedTemplate(id, signal);
        }
      }};
    }));
    setTemplateFiles([]);
    open('uploads');
  }
  async function validateTemplateFile(file: File) {
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
  }
  async function storeTemplateFile(id: string, file: File, name: string, signal: AbortSignal) {
    const ext = file.name.split('.').pop()!.toLowerCase();
    const path = `${uid}/${id}.${ext}`;
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
      signal.throwIfAborted();
      const template: Template = {
        id,
        user_id: uid!,
        name,
        filename: file.name,
        path,
        reference_text: templateText,
        processing_status: demo ? 'ready' : 'pending',
        created_at: now(),
      };
      if (!demo) {
        const { error } = await supabase.from('sala_templates').insert(template);
        if (error) throw error;
      }
      mergeTemplate(template);
    } catch (e) {
      if (!demo) await supabase.storage.from('sala-templates').remove([path]);
      throw e;
    }
  }
  async function signout() {
    if (downloads.running.current) { setModal('downloads'); return; }
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
  function prepareForClass(room: ClassRoom, student: Student | null = null) {
    if (room.archived_at) { setError('Reative a turma antes de preparar provas.'); return; }
    if (downloads.running.current) return;
    setCurrent(room.id);
    setRecoveryStudent(student);
    setGenerationChoice(room.template_override_id ?? (room.use_provaai_template ? 'builtin' : 'inherit'));
    setError('');
    setModal('generate');
  }
  function reviewExam(item: Exam) {setExam(structuredClone(item));open('exam');}
  async function addRecovery(student: Student, goToPage = false) {
    await action(async () => {
      if (student.archived_at) throw new Error('Restaure o aluno na turma antes de adicioná-lo.');
      if (!demo) {
        const {error} = await supabase.from('sala_recovery_students').upsert(
          {user_id:uid,student_id:student.id},{onConflict:'user_id,student_id',ignoreDuplicates:true});
        if (error) throw error;
      }
      setRecoveryMembers(ids => ids.includes(student.id) ? ids : [...ids,student.id]);
      if (goToPage) navigate('recovery');
      setMessage(student.name + ' adicionado a Provas individuais. O vínculo com a turma foi mantido.');
    });
  }
  async function archiveStudent(student: Student, restore = false) {
    if (!restore && !window.confirm(`Retirar ${student.name} da turma? As provas e o histórico serão preservados. Você poderá restaurar o aluno depois.`)) return;
    await action(async () => {
      const archived_at = restore ? null : now();
      if (!demo) {
        const {error} = await supabase.from('sala_students').update({archived_at}).eq('id',student.id).eq('user_id',uid).select('id').single();
        if (error) throw error;
      }
      setData(previous => ({...previous,students:previous.students.map(item => item.id === student.id ? {...item,archived_at} : item)}));
      setMessage(restore ? 'Aluno restaurado na turma.' : 'Aluno retirado. O histórico foi preservado.');
    });
  }
  async function reactivateStudent(student: Student, classId: string) {
    if (busy || generation.busy || downloads.running.current) throw new Error('Aguarde a operação em andamento terminar.');
    const currentStudent = data.students.find(item => item.id === student.id);
    const room = data.classes.find(item => item.id === classId);
    if (!currentStudent?.archived_at) throw new Error('Este aluno já está ativo. Atualize a lista.');
    if (!room || room.archived_at) throw new Error('Escolha uma turma ativa da sua conta.');
    setBusy(true);
    try {
      let restored: Student;
      if (demo) {
        restored = {...currentStudent,class_id:classId,archived_at:null,
          code:classId === currentStudent.class_id ? currentStudent.code
            : nextStudentCode(data.students.filter(item => item.class_id === classId).map(item => item.code))};
      } else {
        const {data: saved,error} = await supabase.rpc('sala_reactivate_student',{p_student:student.id,p_class:classId});
        if (error) throw new Error(cleanError(error));
        restored = saved as Student;
        if (!restored?.id) throw new Error('Não foi possível confirmar a reativação. Atualize a lista.');
      }
      setData(previous => ({...previous,students:previous.students.map(item => item.id === restored.id ? restored : item)}));
      setRecoveryMembers(ids => ids.includes(restored.id) ? ids : [...ids,restored.id]);
      setMessage(`${restored.name} reativado em ${room.name}. Código: ${restored.code}.`);
    } finally {setBusy(false);}
  }
  const pendingExamIds = generation.batch?.exam_ids.slice(generation.batch.completed) ?? [];
  function share(kind: 'class' | 'student', resource: ClassRoom | Student) {
    setShareTarget({ kind, id: resource.id, name: resource.name });
    open('share');
  }
  async function sendCopy(id: string, email: string) {
    await action(async () => {
      if (!shareTarget || demo) throw new Error('Entre na sua conta para compartilhar.');
      const { error } = await supabase.rpc('sala_send_copy', { p_id: id, p_kind: shareTarget.kind, p_resource: shareTarget.id, p_email: email });
      if (error) throw error;
      await loadInvitations();
      setModal(null);
      setMessage('Cópia disponível para o professor receber em Compartilhamentos.');
    });
  }
  async function acceptCopy(invitation: CopyInvitation, classId: string) {
    await action(async () => {
      const { data: destination, error } = await supabase.rpc('sala_accept_copy', { p_invitation: invitation.id, p_class: classId || null });
      if (error) throw error;
      await load(); navigate('classes'); setCurrent(destination as string);
      setMessage('Cópia recebida. Você pode editá-la sem alterar a original.');
    });
  }
  async function cancelCopy(invitation: CopyInvitation) {
    await action(async () => {
      const { error } = await supabase.rpc('sala_cancel_copy', { p_invitation: invitation.id });
      if (error) throw error;
      await loadInvitations(); setMessage('Convite cancelado.');
    });
  }
  async function changeClassStatus(room: ClassRoom) {
    await action(async () => {
      if (classExpired(room)) throw new Error('O prazo de um ano para reativação terminou.');
      const archived_at = room.archived_at ? null : now();
      let saved: ClassRoom = { ...room, archived_at, deletion_due_at: archived_at ? deletionDate(archived_at) : null };
      if (!demo) {
        const result = await supabase.rpc('sala_set_class_active', { p_class: room.id, p_active: Boolean(room.archived_at) });
        if (result.error) throw result.error;
        saved = result.data as ClassRoom;
      }
      setData(previous => ({ ...previous, classes: previous.classes.map(item => item.id === room.id ? saved : item) }));
      setMessage(archived_at ? 'Turma inativada. Você poderá reativá-la em até um ano.' : 'Turma reativada.');
    });
  }
  async function deleteClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
      if (!active || String(form.get('confirmation')).trim() !== active.name) throw new Error('Digite o nome da turma para confirmar.');
      const reason = String(form.get('reason') ?? '').trim();
      if (reason.length < 5 || reason.length > 1000) throw new Error('Descreva o motivo da exclusão (5 a 1000 caracteres).');
      if (!demo) {
        const { error } = await supabase.rpc('sala_delete_class', { p_class: active.id, p_reason: reason });
        if (error) throw error;
        await load();
      } else {
        const ids = new Set(data.students.filter(student => student.class_id === active.id).map(student => student.id));
        setData(previous => ({ ...previous, classes: previous.classes.filter(room => room.id !== active.id),
          students: previous.students.filter(student => !ids.has(student.id)),
          exams: previous.exams.filter(exam => exam.class_id !== active.id && !ids.has(exam.student_id)) }));
        setRecoveryMembers(previous => previous.filter(id => !ids.has(id)));
      }
      navigate('classes'); setMessage('Turma excluída.');
    });
  }
  return (
    <div className="app-shell">
      <aside id="teacher-sidebar" className={`sidebar ${mobile ? 'is-open' : ''}`}>
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
          {sections.filter(section => section.id !== 'settings').map((n) => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.name}
              {n.id === 'exams' && data.exams.some(exam => exam.purpose !== 'recovery') && (
                <span className="nav-count">{data.exams.filter(exam => exam.purpose !== 'recovery').length}</span>
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
        <WorkspaceHeader sections={sections} view={view} className={active?.name}
          email={user?.email} demo={demo} busy={busy} menuOpen={mobile}
          onMenu={() => setMobile(!mobile)} onNavigate={navigate} onSignOut={() => void signout()} />
        <main className="main-content" key={view === 'classes' ? view + String(current) : view}>
          {(downloads.busy || downloads.notice || downloads.error) && <div className="generation-notice download-notice" role="status">
            <BloubMood mood={downloads.error ? 'frustrado' : downloads.busy ? 'sonolento' : 'feliz'} />
            <div><strong>{downloads.busy ? 'Preparando seu download em segundo plano…' : downloads.error || downloads.notice}</strong>
              {downloads.status && <p>{downloads.status.completed} de {downloads.status.total} arquivos preparados. Você pode navegar; novas provas e downloads serão liberados ao terminar.</p>}</div>
            {downloads.busy ? <button className="text-button" onClick={() => setModal('downloads')}>Acompanhar</button>
              : <button className="icon-button" aria-label="Fechar aviso de download" onClick={downloads.dismiss}><X size={16}/></button>}
          </div>}
          {generation.busy && <div className="generation-notice" role="status">
            <BloubMood mood="curioso" />
            <div><strong>Gerando provas com IA em segundo plano…</strong>
              <p>{generation.batch && generation.batch.completed < generation.batch.exam_ids.length
                ? `${generation.batch.title} · ${generation.batch.completed} de ${generation.batch.exam_ids.length} processadas. ` : ''}
                Você pode continuar usando a Provaai. Outra geração será liberada ao terminar.</p></div>
          </div>}
          {generation.syncError && generation.busy && <p role="status">{generation.syncError}</p>}
          {generation.notice && <div className="generation-notice" role="status">
            <span>{generation.notice}</span>
            <button className="text-button" onClick={()=>{generation.dismiss();navigate('exams');}}>Ver provas</button>
            <button className="icon-button" aria-label="Fechar aviso de geração" onClick={generation.dismiss}><X size={16}/></button>
          </div>}
          {uploads.tasks.length > 0 && (uploading || uploadFailed) && (
            <button type="button" className="upload-notice" onClick={() => open('uploads')}>
              {uploading ? <Loader2 size={17} className="spin" /> : <AlertCircle size={17} />}
              <span>{uploading ? 'Anexando modelos em segundo plano' : 'Verificar modelos com falha'}</span>
              <ArrowRight size={16} />
            </button>
          )}
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
                    {data.students.filter(s => !s.archived_at).length}
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
                <select aria-label="Status das turmas" value={classStatus} onChange={e => setClassStatus(e.target.value)}>
                  <option value="active">Turmas ativas</option><option value="inactive">Turmas inativas</option><option value="all">Todas as turmas</option>
                </select>
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
                  .filter(c => classStatus === 'all' || Boolean(c.archived_at) === (classStatus === 'inactive'))
                  .filter((c) =>
                    `${c.name} ${c.subject}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => {
                    const list = data.students.filter(
                        (s) => s.class_id === c.id && !s.archived_at,
                      ),
                      n = list.filter(
                        (s) => s.criteria || s.difficulties,
                      ).length;
                    return (
                      <article key={c.id} className="class-card" style={{borderColor:classColor(c.color)}}>
                      <button type="button" className="class-card-open" aria-label={`Abrir turma ${c.name}`}
                        onClick={() =>
                          startNavigation(() => {
                            setCurrent(c.id);
                            setSearch('');
                          })
                        }
                      >
                        <ClassCover room={c}/>
                        <div className="class-content">
                          <span className="class-subject">{c.subject}</span>
                          <h3>{c.name}</h3>
                          <span className={`status ${c.archived_at ? 'pending' : 'good'}`}>{c.archived_at ? 'Inativa' : 'Ativa'}</span>
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
                      <button type="button" className="class-card-edit" title="Editar turma" aria-label={`Editar turma ${c.name}`}
                        disabled={busy} onClick={()=>{setCurrent(c.id);setError('');setModal('edit-class');}}><Pencil size={19}/></button>
                      </article>
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
              <div className="class-page-cover"><ClassCover room={active}/></div>
              <button
                className="back-link"
                onClick={() => startNavigation(() => setCurrent(null))}
              >
                <ArrowLeft size={16} />
                Todas as turmas
              </button>
              <div className="page-heading">
                <div>
                  <span className="eyebrow"><ClassIcon icon={active.icon} size={20} /> {active.subject}{active.period ? ` · ${active.period}` : ''}</span>
                  <h1>
                    {active.name}
                    <span>.</span>
                  </h1>
                  <p>
                    Conheça os caminhos e prepare o próximo passo de cada aluno.
                  </p>
                </div>
                <div className="actions">
                  <button className="button secondary" disabled={busy} onClick={() => open('edit-class')}><Pencil size={17} />Editar turma</button>
                  <button className="button secondary" disabled={busy} onClick={() => share('class', active)}>Compartilhar cópia</button>
                  <button
                    className="button secondary"
                    disabled={Boolean(active.archived_at) || busy}
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
                    disabled={Boolean(active.archived_at) || !students.length || generation.busy || downloads.busy}
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
              {active.archived_at && <div className="class-archive-notice" role="status">
                <strong>Turma inativa</strong><p>Você pode reativá-la até {new Date(active.deletion_due_at!).toLocaleDateString('pt-BR')}. Após esse prazo, a turma, seus alunos vinculados e suas provas serão excluídos automaticamente.</p>
                <button className="button secondary" disabled={busy || generation.busy || classExpired(active)} onClick={() => void changeClassStatus(active)}>Reativar turma</button>
              </div>}
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
                <button className="button secondary small-button" onClick={() => setShowArchived(value => !value)}>
                  {showArchived ? 'Ver alunos ativos' : `Alunos retirados (${data.students.filter(s => s.class_id === current && s.archived_at).length})`}
                </button>
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
              {!students.length && !showArchived ? (
                <Empty
                  title="Vamos conhecer sua turma?"
                  text="Cadastre o primeiro aluno e registre o que ele precisa praticar."
                  action={
                    <button
                      className="button primary"
                      disabled={Boolean(active.archived_at)}
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
                      {data.students.filter(s => s.class_id === current && Boolean(s.archived_at) === showArchived)
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
                                disabled={Boolean(s.archived_at)}
                                aria-label={`Editar ${s.name}`}
                                onClick={() => {
                                  setEditing(s);
                                  open('student');
                                }}
                              >
                                <Pencil size={17} />
                              </button>
                              {!s.archived_at && <button className="button secondary small-button" disabled={busy || recoveryMembers.includes(s.id)}
                                onClick={() => void addRecovery(s,true)} aria-label={`Adicionar ${s.name} a Provas individuais`}>
                                {recoveryMembers.includes(s.id) ? 'Em Provas individuais' : 'Prova individual'}
                              </button>}
                              <button className="button secondary small-button" disabled={busy} onClick={() => share('student', s)}>Compartilhar cópia</button>
                              <button className="button secondary small-button" disabled={busy || generation.busy || Boolean(active.archived_at)}
                                onClick={() => void archiveStudent(s,Boolean(s.archived_at))} aria-label={`${s.archived_at ? 'Restaurar' : 'Retirar'} ${s.name} ${s.archived_at ? 'na' : 'da'} turma`}>
                                {s.archived_at ? 'Restaurar' : 'Retirar'}
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
          {view === 'students' && <StudentsWorkspace students={data.students} classes={data.classes} exams={data.exams}
            busy={busy || generation.busy} onEdit={student => { setEditing(student); setCurrent(student.class_id); open('student'); }}
            onShare={student => share('student', student)} onArchive={student => void archiveStudent(student)}
            onReactivate={student => { setEditing(student); open('reactivate'); }}
            onClass={id => { navigate('classes'); setCurrent(id); }} />}
          {view === 'sharing' && <CopySharing invitations={invitations} userId={uid} classes={data.classes} demo={demo}
            busy={busy || generation.busy} onAccept={(item, classId) => void acceptCopy(item, classId)}
            onCancel={item => void cancelCopy(item)} onRefresh={() => void action(loadInvitations)} />}
          {view === 'exams' && <ExamLibrary classes={data.classes} exams={data.exams} pending={pendingExamIds}
            roomId={current} onRoomChange={setCurrent}
            busy={busy || downloads.busy || generation.busy} generating={generation.busy || downloads.busy} onReview={reviewExam} onPrepare={prepareForClass}
            onDownload={startDownload}/>}
          {view === 'recovery' && <RecoveryWorkspace classes={data.classes} students={data.students}
            exams={data.exams} members={recoveryMembers} pending={pendingExamIds} busy={busy} generating={generation.busy || downloads.busy}
            onReview={reviewExam} onReactivate={student => { setEditing(student); open('reactivate'); }} onAdd={student => void addRecovery(student)} onPrepare={student => {
              const room=data.classes.find(item => item.id === student.class_id);
              if (room) prepareForClass(room,student);
            }}/>}
          {view === 'templates' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">O SEU JEITO DE AVALIAR</span>
                  <h1>
                    Modelos de prova<span>.</span>
                  </h1>
                  <p>
                    Adicione seus modelos e escolha qual a IA deve usar por padrão nas suas turmas.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setTemplateText('');
                    setTemplateFiles([]);
                    open('template');
                  }}
                >
                  <Upload size={18} />
                  Adicionar modelos
                </button>
              </div>
              <div className="notice soft">
                <BookOpen size={21} />
                <p>
                  A IA usa o conteúdo extraído do arquivo e suas orientações.
                  Revise o texto antes de gerar provas. PDFs digitalizados são
                  lidos por IA; imagens dentro de arquivos Word não são
                  extraídas. Modelos DOCX também fornecem a diagramação do PDF e do Word. Use campos em branco como “Nome do estudante:”, “Turma:” e “Tema”.
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
                  {defaultControl(null)}
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
                    {defaultControl(t.id, templateReady(t.id))}
                    <p>
                      {uploads.active.some(task => task.id === t.id) ? 'Anexando modelo…' : t.processing_status === 'ready'
                        ? 'Leitura concluída'
                        : t.processing_error || 'Leitura pendente'}
                    </p>
                    {!demo && (
                      <button
                        disabled={busy || uploads.active.some(task => task.id === t.id)}
                        className="text-button"
                        onClick={() => {
                          uploads.enqueue([{ id: t.id, name: t.name, run: async (report, signal) => {
                            report('reading');
                            await readSavedTemplate(t.id, signal);
                          }}]);
                          open('uploads');
                        }}
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
                              setData(d => ({ ...d, templates: d.templates.map(row => row.id === t.id
                                ? { ...row, extracted_text: String(f.get('text')) } : row) }));
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
                        setTeacherTemplate(null);
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
            modal === 'edit-class' ? 'Configurações da turma'
              : modal === 'delete-class' ? 'Excluir turma'
              : modal === 'share' ? 'Compartilhar uma cópia'
              : modal === 'reactivate' ? 'Reativar aluno'
              : modal === 'class'
              ? 'Uma nova turma'
              : modal === 'student'
                ? editing
                  ? 'Perfil do aluno'
                  : 'Conheça mais um aluno'
                : modal === 'generate'
                  ? recoveryStudent ? 'Preparar prova individual' : 'Preparar provas coletivas'
                  : modal === 'downloads' ? 'Download de provas'
                  : modal === 'uploads' ? 'Envio de modelos'
                  : modal === 'template'
                    ? 'Adicionar modelos de referência'
                    : 'Revisar prova'
          }
          wide={modal === 'exam' || modal === 'generate' || modal === 'class' || modal === 'edit-class'}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === 'downloads' && <section className="upload-wait">
            <BloubMood mood={downloads.error ? 'frustrado' : downloads.busy ? 'sonolento' : 'feliz'} />
            <h3 role="status">{downloads.busy ? 'Preparando suas provas! Aguarde um pouquinho.' : downloads.error ? 'Não foi possível concluir o download.' : 'Arquivo pronto!'}</h3>
            <p>{downloads.error || (downloads.busy ? 'Você pode continuar explorando o site. Mantenha esta aba aberta até o download terminar.' : downloads.notice)}</p>
            {downloads.status && <p role="status">{downloads.status.completed < downloads.status.total
              ? 'Preparando arquivo ' + (downloads.status.completed + 1) + ' de ' + downloads.status.total + '…'
              : 'Finalizando o arquivo para download…'}</p>}
            <button className="button primary" onClick={() => setModal(null)}>{downloads.busy ? 'Continuar navegando' : 'Concluir'}</button>
          </section>}
          {modal === 'uploads' && (
            <section className="upload-wait">
              <BloubMood mood={uploading ? 'sonolento' : 'curioso'} />
              <h3 role="status">{uploading ? 'Anexando modelo de prova! Aguarde um pouquinho.' : 'Confira o resultado do envio.'}</h3>
              {uploading && <p>Pode continuar usando a Provaai. Mantenha esta aba aberta até o envio e a leitura terminarem.</p>}
              <ul>
                {uploads.tasks.map(task => <li key={task.id}>
                  <strong>{task.name}</strong>
                  <span>{task.error || uploadStages[task.stage]}</span>
                </li>)}
              </ul>
              <button className="button primary" type="button" onClick={() => {
                if (!uploading) uploads.dismiss();
                setModal(null);
              }}>{uploading ? 'Continuar em segundo plano' : 'Concluir'}</button>
            </section>
          )}
          {modal === 'share' && shareTarget && <ShareCopyForm key={`${shareTarget.kind}:${shareTarget.id}`} target={shareTarget} demo={demo} busy={busy} onSend={sendCopy} onCancel={() => setModal(null)} />}
          {modal === 'delete-class' && active && <form onSubmit={deleteClass}>
            <p>A exclusão de <strong>{active.name}</strong> é permanente. Remove os alunos ainda vinculados, todas as provas desses alunos e as provas desta turma. Convites pendentes também serão cancelados. Cópias já recebidas por outros professores são independentes.</p>
            <p className="helper-note">Para manter os dados e poder voltar depois, use Inativar turma.</p>
            <Field label="Motivo da exclusão"><textarea name="reason" required minLength={5} maxLength={1000} rows={3} disabled={busy} /></Field>
            <Field label={`Digite ${active.name} para confirmar`}><input name="confirmation" required autoComplete="off" disabled={busy} /></Field>
            <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModal('edit-class')}>Cancelar</button>
              <button className="button danger" disabled={busy || generation.busy}>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button></div>
          </form>}
          {modal === 'reactivate' && editing && <form onSubmit={event => {
            event.preventDefault(); const classId = String(new FormData(event.currentTarget).get('classId'));
            void reactivateStudent(editing, classId).then(() => setModal(null)).catch(error => setError(cleanError(error)));
          }}><p>Escolha a turma para reativar <strong>{editing.name}</strong>. O histórico de provas será mantido.</p>
            <p className="helper-note">Na turma de origem, o código será mantido. Em outra turma, um novo código será gerado automaticamente.</p>
            <Field label="Turma de destino"><select name="classId" required defaultValue={data.classes.some(room => room.id === editing.class_id && !room.archived_at) ? editing.class_id : ''} disabled={busy}>
              <option value="" disabled>Selecione uma turma ativa</option>{data.classes.filter(room => !room.archived_at).map(room => <option value={room.id} key={room.id}>{room.name} · {room.subject}</option>)}
            </select></Field><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModal(null)}>Cancelar</button>
              <button className="button primary" disabled={busy || generation.busy}>{busy ? 'Reativando…' : 'Reativar aluno'}</button></div></form>}
          {(modal === 'class' || modal === 'edit-class') && (
            <ClassSettings key={modal === 'edit-class' ? active?.id : 'new'} room={modal === 'edit-class' ? active ?? undefined : undefined}
              busy={busy} onSave={saveClass} onCancel={() => setModal(null)}>
              {modal === 'edit-class' && active && <section className="class-lifecycle">
                <h3>Status da turma: {active.archived_at ? 'inativa' : 'ativa'}</h3>
                <p className="helper-note">Inativar preserva os dados por um ano. Você pode reativar nesse período. Ao completar um ano de inatividade, a turma, os alunos vinculados e suas provas serão excluídos pela rotina automática diária.</p>
                <div className="actions"><button type="button" className="button secondary" disabled={busy || generation.busy || classExpired(active)} onClick={() => void changeClassStatus(active)}>
                  {active.archived_at ? 'Reativar turma' : 'Inativar turma'}</button>
                  <button type="button" className="button danger" disabled={busy || generation.busy} onClick={() => open('delete-class')}><Trash2 size={16} />Excluir turma</button></div>
              </section>}
            </ClassSettings>
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
                    value={editing?.code || generatedStudentCode}
                    readOnly
                    aria-describedby="student-code-help"
                    required
                    maxLength={30}
                  />
                  <small id="student-code-help" className="muted">
                    {editing ? 'Código vinculado a este aluno.' : studentCodePending ? 'Confirmando código disponível…' : 'Gerado automaticamente e confirmado ao salvar.'}
                  </small>
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
                <button className="button primary" disabled={busy || (!editing && (studentCodePending || !generatedStudentCode))}>
                  {busy ? 'Salvando…' : 'Salvar perfil'}
                  <Check size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'generate' && active && (
            <form onSubmit={createExams}>
              <p className="muted">
                {recoveryStudent ? `Uma prova exclusiva para ${recoveryStudent.name}. O aluno permanece na turma de origem.` : 'Uma prova por aluno, orientada pelo que ele precisa aprender.'}
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
                    defaultValue={recoveryStudent ? `Prova individual · ${active.subject}` : undefined}
                    placeholder="Ex.: Frações no cotidiano"
                    required
                    maxLength={120}
                  />
                </Field>
              </div>
              <Field label="Matéria desta prova">
                <input name="subject" defaultValue={active.subject} required maxLength={80}
                  placeholder="Ex.: Matemática" aria-describedby="exam-subject-help" />
                <small id="exam-subject-help" className="muted">Vale para esta avaliação. Você pode escolher uma matéria diferente da turma.</small>
              </Field>
              <Field label="Conteúdos e objetivos desta prova">
                <textarea
                  name="topics"
                  rows={2}
                  placeholder="Ex.: Frações equivalentes, adição e subtração. Aplicar conceitos em problemas do cotidiano."
                  required
                  maxLength={3000}
                />
              </Field>
              <p className="helper-note">A matéria e os conteúdos acima orientam esta prova. O perfil do aluno e o modelo escolhido serão adaptados a esse pedido.</p>
              <QuestionCounts />
              <Field label="Modelo de referência">
                <select name="template_choice" value={generationChoice}
                  onChange={event => setGenerationChoice(event.target.value)} aria-describedby="class-template-hint">
                  <option value="inherit">Seguir meu padrão · {teacherTemplateName}</option>
                  <option value="builtin">Modelo Provaai</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id} disabled={!templateReady(t.id)}>
                      {t.name}{!templateReady(t.id) ? ' · leitura pendente' : ''}
                    </option>
                  ))}
                  {uploads.active.filter(task => !data.templates.some(t => t.id === task.id)).map(task => (
                    <option key={task.id} value={task.id} disabled>{task.name} · anexando</option>
                  ))}
                </select>
              </Field>
              <p className="helper-note" id="class-template-hint">
                {templateReady(generationTemplate)
                  ? recoveryStudent ? 'Este modelo será usado nesta prova individual. O padrão da turma permanece o mesmo.' : 'Ao preparar as provas, a escolha fica salva só nesta turma. Selecione “Seguir meu padrão” para acompanhar as mudanças feitas em Modelos.'
                  : 'O modelo escolhido ainda não está pronto. Aguarde a leitura ou selecione outro modelo.'}
              </p>
              <h3>Quem vai receber a prova?</h3>
              <div className="student-picks" key={current}>
                {(recoveryStudent ? [recoveryStudent] : students).map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      name="student"
                      disabled={Boolean(recoveryStudent)}
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
                  disabled={busy || downloads.busy || generation.busy || !students.length || !templateReady(generationTemplate)}
                >
                  {busy ? 'Preparando…' : recoveryStudent ? 'Preparar prova individual' : 'Preparar provas'}
                  <Sparkles size={17} />
                </button>
              </div>
            </form>
          )}
          {modal === 'template' && (
            <form className="template-upload" onSubmit={uploadTemplate}>
              <TemplateFilePicker files={templateFiles} onChange={setTemplateFiles} disabled={busy} />
              <Field label="Orientações adicionais (opcional)">
                <textarea
                  rows={2}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  maxLength={12000}
                  placeholder="Ex.: Priorize questões de interpretação."
                />
              </Field>
              <p className="helper-note">
                Remova dados pessoais antes de enviar. Os PDFs são lidos pela IA.
                Confira o texto extraído em Modelos.
              </p>
              <div className="dialog-actions">
                <button className="button primary" disabled={busy || !templateFiles.length}>
                  {busy ? progress || 'Enviando…' : templateFiles.length > 1 ? 'Salvar modelos' : 'Salvar modelo'}
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
                    disabled={busy || downloads.busy || generation.busy || !templateReady(exam.template_id) || !data.students.some(student => student.id === exam.student_id && !student.archived_at && student.class_id === exam.class_id)}
                    title={templateReady(exam.template_id) ? undefined : 'Aguarde a leitura do modelo desta prova.'}
                    onClick={() =>
                      void action(async () => {
                        if (downloads.running.current) return;
                        await generation.start({retry:exam.id});
                        setModal(null);
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
                      disabled={busy || downloads.busy || generation.busy}
                      onClick={() => startDownload([exam], 'pdf', true)}
                    >
                      Gabarito
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy || downloads.busy || generation.busy}
                      onClick={() => startDownload([exam], 'docx')}
                    >
                      DOCX <Download size={16} />
                    </button>
                    <button
                      className="button primary"
                      disabled={busy || downloads.busy || generation.busy}
                      onClick={() => startDownload([exam], 'pdf')}
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
