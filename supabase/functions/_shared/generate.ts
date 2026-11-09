import { createClient } from '@supabase/supabase-js';
import {
  duplicateQuestions,
  examContentSchema,
  generationSchema,
} from './exam.ts';
import { checkQuestionMix, questionMix } from './question-mix.ts';
import { examAi } from './ai-fallback.ts';
import { mistralQuestions } from '../sala-ai-mistral/mistral.ts';
import { generationInstruction, scopeReviewInstruction, checkExamScope } from './exam-scope.ts';
const fail = (message: string, status: number) =>
  Response.json({ error: { message } }, { status });
type Settings = {
  url: string;
  anonKey: string;
  provider: 'gemini' | 'mistral';
  model: string;
  apiKey?: string | null;
  groqApiKey?: string | null;
};
export async function generate(
  req: Request,
  { url, anonKey, provider, model, apiKey, groqApiKey }: Settings,
) {
  if (req.method !== 'POST') return fail('Método não permitido.', 405);
  if (Number(req.headers.get('content-length')) > 4096)
    return fail('Pedido muito grande.', 413);
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer '))
    return fail('Entre na sua conta para gerar provas.', 401);
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(bearer.slice(7));
  if (authError || !user)
    return fail('Sua sessão expirou. Entre novamente.', 401);
  if (!apiKey && !(provider === 'gemini' && groqApiKey))
    return fail(
      'A geração por IA aguarda a configuração da chave de IA no servidor. Você pode criar e revisar questões manualmente.',
      503,
    );
  let parsed;
  try {
    const input = await req.text();
    if (input.length > 4096) return fail('Pedido muito grande.', 413);
    parsed = generationSchema.safeParse(JSON.parse(input));
  } catch {
    return fail('Pedido inválido.', 400);
  }
  if (!parsed.success)
    return fail('Confira a prova e a quantidade de questões.', 422);
  const { data: record, error } = await db
    .from('sala_exams')
    .select('*')
    .eq('id', parsed.data.examId)
    .single();
  if (error || !record) return fail('Prova não encontrada.', 404);
  const exam = record;
  if (exam.content.questions.length) return Response.json({ exam });
  let mix;
  try {
    mix = questionMix(
      exam.question_count,
      parsed.data.objectiveCount ?? exam.content.objectiveCount,
    );
  } catch {
    return fail('Distribuição de questões inválida.', 422);
  }
  const { error: claimError } = await db
    .from('sala_generation_jobs')
    .insert({ exam_id: exam.id, user_id: user.id });
  if (claimError)
    return fail(
      'Esta geração já foi solicitada. Consulte a prova antes de tentar novamente.',
      409,
    );
  try {
    if (exam.content.objectiveCount !== mix.objective) {
      const { error } = await db
        .from('sala_exams')
        .update({ content: { ...exam.content, objectiveCount: mix.objective } })
        .eq('id', exam.id);
      if (error) throw error;
    }
    let reference = '';
    if (exam.template_id) {
      const { data: t, error: te } = await db
        .from('sala_templates')
        .select('filename,reference_text,extracted_text,processing_status')
        .eq('id', exam.template_id)
        .single();
      if (te || !t || t.processing_status !== 'ready')
        throw new Error('Processe e revise o modelo antes de gerar a prova.');
      // PDF define apenas a aparência na exportação. Nunca reutilizar perguntas
      // ou transcrições de PDFs antigos no contexto enviado aos provedores.
      reference = /\.pdf$/i.test(t.filename ?? '') ? '' :
        'Orientações do professor: ' + (t.reference_text || '') +
        '\nAtividade de referência: ' + (t.extracted_text || '');
    }
    let previousExams = db
      .from('sala_exams')
      .select('content')
      .eq('class_id', exam.class_id)
      .eq('subject', exam.subject)
      .eq('topics', exam.topics)
      .neq('id', exam.id);
    previousExams = exam.purpose === 'recovery'
      ? previousExams.eq('student_id', exam.student_id)
      : previousExams.eq('title', exam.title);
    const { data: otherRows, error: otherError } = await previousExams;
    if (otherError)
      throw new Error('Não foi possível verificar provas anteriores.');
    // No names, student codes or identifiers are sent. Free-text profile fields may still be personal:
    // deployment requires the teacher to use educational criteria without identifying information.
    const context = {
      purpose: exam.purpose === 'recovery' ? 'Prova individual' : 'Prova coletiva',
      title: exam.title,
      subject: exam.subject,
      topics: exam.topics,
      count: exam.question_count,
      distribution: mix,
      profile: {
        difficulties: exam.profile_snapshot.difficulties,
        criteria: exam.profile_snapshot.criteria,
        level: exam.profile_snapshot.level,
      },
      reference: reference.slice(0, 60000),
      exclude: (otherRows || [])
        .flatMap((e) =>
          e.content.questions.map((q: { statement: string }) => q.statement),
        )
        .slice(-100),
    };
    const ask = examAi({ apiKey, model, groqApiKey });
    const raw =
      provider === 'mistral'
        ? await mistralQuestions(apiKey!, model, generationInstruction, context)
        : await ask(generationInstruction, context, 'generation');
    const content = examContentSchema.parse(JSON.parse(raw));
    checkQuestionMix(content.questions, mix);
    content.objectiveCount = mix.objective;
    if (
      duplicateQuestions(
        content,
        (otherRows || []).map((r) => r.content),
      )
    )
      throw new Error('Foram detectadas questões repetidas. Tente novamente.');
    // A conferência não recebe perfil, modelo nem provas antigas que possam desviar o pedido.
    const reviewContext = {
      subject: exam.subject, topics: exam.topics,
      instructions: content.instructions, questions: content.questions,
    };
    const reviewOptions = { signal: AbortSignal.timeout(25000), maxOutputTokens: 2048, temperature: 0 };
    const review = provider === 'mistral'
      ? await mistralQuestions(apiKey!, model, scopeReviewInstruction, reviewContext, fetch, reviewOptions)
      : await ask(scopeReviewInstruction, reviewContext, 'review');
    checkExamScope(review, content.questions.length);
    const { data: saved, error: saveError } = await db
      .from('sala_exams')
      .update({ content, status: 'draft' })
      .eq('id', exam.id)
      .select()
      .single();
    if (saveError) throw saveError;
    await db
      .from('sala_generation_jobs')
      .update({ status: 'succeeded' })
      .eq('exam_id', exam.id);
    return Response.json({ exam: saved });
  } catch (error) {
    await db.from('sala_generation_jobs').delete().eq('exam_id', exam.id);
    return fail(
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? 'A IA demorou demais. O rascunho foi preservado; tente novamente.'
          : error.message
        : 'Não foi possível gerar a prova.',
      502,
    );
  }
}
