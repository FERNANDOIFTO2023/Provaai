import { createClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '@/lib/supabase';
import { fillDocxLayout } from '@/lib/docx-layout';
import { examFile } from '@/lib/export';
import { officePdf } from '@/lib/office-pdf';
import type { Exam } from '@/lib/model';

export const maxDuration=120;
export async function POST(req: Request) {
  const bearer=req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return new Response(null,{status:401});
  const input=await req.json().catch(()=>null);
  if (!input || typeof input.id!=='string' || !/^[a-f\d-]{36}$/i.test(input.id) ||
    !['docx','pdf'].includes(input.format)) return new Response(null,{status:400});
  const db=createClient(supabaseUrl,supabaseKey,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
  const {data:{user}}=await db.auth.getUser(bearer.slice(7));
  if (!user) return new Response(null,{status:401});
  const fail=(error:string,status:number)=>Response.json({error},{status});
  const {data:exam}=await db.from('sala_exams').select('*').eq('id',input.id).eq('user_id',user.id).maybeSingle();
  if (!exam) return fail('Prova não encontrada.',404);
  if (exam.status!=='approved') return fail('Aprove a prova antes de exportar.',409);
  const key=input.answerKey===true;
  try {
    let document: Uint8Array | undefined;
    if (exam.template_id) {
      const {data:t}=await db.from('sala_templates').select('filename,path').eq('id',exam.template_id).eq('user_id',user.id).single();
      if (!t) return fail('O modelo vinculado não está disponível.',409);
      if (/\.docx$/i.test(t.filename)) {
        const [{data:file},{data:room}]=await Promise.all([
          db.storage.from('sala-templates').download(t.path),
          db.from('sala_classes').select('name').eq('id',exam.class_id).eq('user_id',user.id).single(),
        ]);
        if (!file || !room) return fail('Não foi possível abrir o modelo ou a turma. Tente novamente.',409);
        document=await fillDocxLayout(new Uint8Array(await file.arrayBuffer()),exam as Exam,room.name,
          typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:'',key);
      }
    }
    document ??= new Uint8Array(await (await examFile(exam as Exam,'docx',key)).arrayBuffer());
    const pdf=input.format==='pdf';
    const bytes=pdf?await officePdf(document):document;
    return new Response(new Uint8Array(bytes),{headers:{'Cache-Control':'private, no-store',
      'Content-Type':pdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});
  } catch {
    return fail('Não foi possível exportar a prova. Confira se o modelo abre no Word e tente novamente.',422);
  }
}
