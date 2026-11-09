import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import WordExtractor from 'npm:word-extractor@1.0.4';
import { Buffer } from 'node:buffer';
import { generate } from './generate.ts';
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
Deno.serve(async (req: Request) => {
  if (req.method === 'GET')
    return json({
      provider: 'mistral',
      questionMix: true,
      aiConfigured: !!Deno.env.get('MISTRAL_API_KEY'),
    });
  if (req.method !== 'POST')
    return json({ error: { message: 'Método não permitido.' } }, 405);
  const authorization = req.headers.get('authorization') || '';
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    },
  );
  const {
    data: { user },
  } = await db.auth.getUser(authorization.replace(/^Bearer /, ''));
  if (!user) return json({ error: { message: 'Sessão inválida.' } }, 401);
  if (
    ['generate', 'generate-with-mix'].includes(
      new URL(req.url).searchParams.get('operation') || '',
    )
  )
    return generate(req);
  let id: string | undefined;
  try {
    const body = await req.json();
    id = body.templateId;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))
      return json({ error: { message: 'Modelo inválido.' } }, 400);
    const { data: t, error } = await db
      .from('sala_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !t)
      return json({ error: { message: 'Modelo não encontrado.' } }, 404);
    const { data: file, error: downloadError } = await db.storage
      .from('sala-templates')
      .download(t.path);
    if (downloadError || !file)
      throw new Error('Não foi possível ler o arquivo.');
    if (file.size > 20 * 1024 * 1024)
      throw new Error('O limite do arquivo é 20 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = t.path.split('.').pop();
    let text = '';
    if (ext === 'pdf') {
      throw new Error('PDF é um modelo visual. Use Validar PDF novamente no site para configurar o cabeçalho.');
    } else if (ext === 'doc' || ext === 'docx') {
      const valid =
        ext === 'doc'
          ? bytes[0] === 208 && bytes[1] === 207
          : bytes[0] === 80 && bytes[1] === 75;
      if (!valid) throw new Error('Arquivo Word inválido.');
      const document = await new WordExtractor().extract(bytes);
      text = document.getBody();
    } else throw new Error('Formato não suportado.');
    if (text.trim().length < 20)
      throw new Error(
        'Não foi encontrado texto suficiente. Use um documento legível e sem senha.',
      );
    if (text.length > 60000)
      throw new Error(
        'O modelo excede 60 mil caracteres. Envie um arquivo menor.',
      );
    const { data: saved, error: saveError } = await db
      .from('sala_templates')
      .update({
        extracted_text: text,
        processing_status: 'ready',
        processing_error: null,
      })
      .eq('id', id)
      .select()
      .single();
    if (saveError) throw new Error('Falha ao salvar o texto extraído.');
    return json({ template: saved });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha no processamento.';
    if (id)
      await db
        .from('sala_templates')
        .update({ processing_status: 'error', processing_error: message })
        .eq('id', id);
    return json({ error: { message } }, 422);
  }
});
