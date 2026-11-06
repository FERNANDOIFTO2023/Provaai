import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '@/lib/supabase';
import { POST as generateExam } from '../generate/route';

export const maxDuration = 150;

// Cada chamada reserva uma prova. A próxima recebe seu próprio tempo de execução.
export async function POST(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response(null, {status:401});
  const db = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession:false, autoRefreshToken:false },
  });
  const {data: step, error} = await db.rpc('sala_claim_exam_step');
  if (error) return new Response(null, {status: error.code === 'PGRST301' ? 401 : 503});
  if (!step) return new Response(null, {status:204});
  after(async () => {
    let failure: string | null = null;
    try {
      const result = await generateExam(new Request(req.url, {
        method:'POST', headers:{authorization, 'content-type':'application/json'},
        body:JSON.stringify({examId:step.examId}),
      }));
      if (!result.ok) {
        const body = await result.json();
        failure = body.error?.message || 'A IA não concluiu a prova.';
      }
    } catch { failure = 'A geração foi interrompida. Tente novamente no rascunho.'; }
    const {data: more} = await db.rpc('sala_finish_exam_step', {p_lease:step.lease,p_error:failure});
    // Apenas a origem de produção configurada na Vercel pode receber o token.
    // Em desenvolvimento, ou após interrupção, a tela autenticada também retoma o lote.
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (more && process.env.VERCEL_ENV === 'production' && host && /^[a-z0-9.-]+$/i.test(host)) {
      await fetch(`https://${host}/api/exam-batch`, {
        method:'POST', headers:{authorization}, redirect:'error', signal:AbortSignal.timeout(7000),
      }).catch(() => {});
    }
  });
  return new Response(null,{status:202});
}
