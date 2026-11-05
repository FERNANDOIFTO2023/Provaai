import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from './supabase';
export async function edgeProxy(req: Request, operation: string) {
  const useMistral = process.env.AI_PROVIDER === 'mistral';
  const functionName = useMistral ? 'sala-ai-mistral' : 'sala-ai';
  const providerKey = useMistral
    ? process.env.MISTRAL_API_KEY
    : process.env.GEMINI_API_KEY;
  const keyHeader = useMistral ? 'x-mistral-key' : 'x-gemini-key';
  const authorization = req.headers.get('authorization') || '';
  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
  } = await db.auth.getUser(authorization.replace(/^Bearer /, ''));
  if (!user)
    return Response.json(
      { error: { message: 'Entre novamente para continuar.' } },
      { status: 401 },
    );
  if (Number(req.headers.get('content-length') || 0) > 4096)
    return new Response(null, { status: 413 });
  try {
    const body = await req.text();
    if (body.length > 4096) return new Response(null, { status: 413 });
    const upstream = await fetch(
      `${supabaseUrl}/functions/v1/${functionName}?operation=${operation}`,
      {
        method: 'POST',
        headers: {
          authorization,
          apikey: supabaseKey,
          'content-type': 'application/json',
          ...(providerKey ? { [keyHeader]: providerKey } : {}),
        },
        body,
        signal: AbortSignal.timeout(120000),
      },
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          message: 'O processamento demorou além do esperado. Tente novamente.',
        },
      },
      { status: 504 },
    );
  }
}
