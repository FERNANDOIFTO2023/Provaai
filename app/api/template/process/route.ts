import { edgeProxy } from '@/lib/edge-proxy';
import { createClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '@/lib/supabase';
import { pdfHeader, headerRatio } from '@/lib/pdf-header';
export const maxDuration = 120;
export async function POST(req: Request) {
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return new Response(null,{status:401});
  const body = await req.text();
  if (body.length > 4096) return new Response(null,{status:413});
  let input;
  try { input = JSON.parse(body); } catch { return new Response(null,{status:400}); }
  if (!input || typeof input.templateId !== 'string' || !/^[a-f\d-]{36}$/i.test(input.templateId))
    return new Response(null,{status:400});
  const db = createClient(supabaseUrl,supabaseKey,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
  const {data:{user}} = await db.auth.getUser(bearer.slice(7));
  if (!user) return new Response(null,{status:401});
  const {data:template} = await db.from('sala_templates').select('*').eq('id',input.templateId).eq('user_id',user.id).single();
  if (!template) return Response.json({error:{message:'Modelo não encontrado.'}},{status:404});
  if (!/\.pdf$/i.test(template.filename)) return edgeProxy(new Request(req.url,{
    method:'POST',headers:req.headers,body}), 'template');
  try {
    const ratio = headerRatio(input.headerRatio ?? template.pdf_header_ratio ?? 0.25);
    const {data:file,error} = await db.storage.from('sala-templates').download(template.path);
    if (error || !file) throw new Error('Não foi possível abrir o modelo.');
    const header = await pdfHeader(new Uint8Array(await file.arrayBuffer()),ratio);
    if (input.preview === true) return new Response(new Uint8Array(header.image),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});
    const {data:saved,error:saveError} = await db.from('sala_templates').update({
      pdf_header_ratio:ratio,extracted_text:'',processing_status:'ready',processing_error:null,
    }).eq('id',template.id).eq('user_id',user.id).select().single();
    if (saveError) throw new Error('Não foi possível salvar o cabeçalho. Confira se a atualização do banco foi aplicada.');
    return Response.json({template:saved},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível preparar o cabeçalho.';
    // Uma prévia inválida não invalida um modelo anteriormente configurado.
    if (!input.preview && template.processing_status !== 'ready') await db.from('sala_templates')
      .update({processing_status:'error',processing_error:message}).eq('id',template.id).eq('user_id',user.id);
    return Response.json({error:{message}},{status:422,headers:{'Cache-Control':'no-store'}});
  }
}
