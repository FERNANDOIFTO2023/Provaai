import { createClient } from '@supabase/supabase-js';

type Settings = { url: string; publicKey: string; serviceKey: string };
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

async function digest(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleCode(req: Request, settings: Settings) {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!settings.url || !settings.publicKey || !settings.serviceKey)
    return json({ error: 'O acesso está temporariamente indisponível.' }, 503);
  let input: { action?: string; email?: string; code?: string };
  try {
    if (Number(req.headers.get('content-length')) > 2048) return json({ error: 'Pedido inválido.' }, 413);
    const body = await req.text();
    if (body.length > 2048) return json({ error: 'Pedido inválido.' }, 413);
    input = JSON.parse(body);
    if (!input || typeof input !== 'object') throw new Error();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !['request', 'verify'].includes(input.action ?? ''))
    return json({ error: 'Confira o e-mail informado.' }, 422);
  if (input.action === 'verify' && !/^\d{6,10}$/.test(code))
    return json({ error: 'Digite o código numérico recebido por e-mail.', code: 'invalid_code' }, 422);

  // Clientes separados impedem que a sessão emitida substitua a credencial administrativa.
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url: RequestInfo | URL, init?: RequestInit) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } };
  const admin = createClient(settings.url, settings.serviceKey, options);
  const auth = createClient(settings.url, settings.publicKey, options).auth;
  const emailKey = await digest(settings.serviceKey, 'email:' + email);
  const proof = input.action === 'verify'
    ? await digest(settings.serviceKey, 'code:' + email + ':' + code) : null;
  let lease: string | undefined;

  async function claim(action: string) {
    const { data, error } = await admin.rpc('provaai_code_claim', {
      p_email_key: emailKey, p_action: action, p_digest: proof,
    });
    if (error || !data) throw new Error('database');
    lease = data.lease;
    return data;
  }
  async function finish(result: string, userId?: string) {
    if (!lease) throw new Error('lease');
    const { data, error } = await admin.rpc('provaai_code_finish', {
      p_email_key: emailKey, p_lease: lease, p_result: result,
      p_digest: proof, p_user_id: userId ?? null,
    });
    if (error || !data || data.status === 'stale') throw new Error('database');
    lease = undefined;
    return data;
  }
  async function requestCode(rotated = false): Promise<Response> {
    const state = await claim('request');
    if (state.status === 'busy') return json({ error: 'Já há uma solicitação em andamento. Aguarde alguns segundos.' }, 409);
    if (state.status === 'rate_limit') return json({
      error: 'O limite de novos códigos foi atingido. Aguarde antes de solicitar novamente.',
      code: 'send_limit',
    }, 429);
    if (state.status === 'reused') return json({
      reused: true, expiresAt: state.expiresAt, rotated,
    });
    if (state.status !== 'send') throw new Error('state');
    const send = () => auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    let { error } = await send();
    if (error?.code === 'over_email_send_rate_limit' && /after .*seconds?/i.test(error.message)) {
      const { data: released } = await admin.rpc('provaai_release_email_interval', {
        p_email_key: emailKey, p_lease: lease, p_email: email,
      });
      if (released) ({ error } = await send());
    }
    if (error) {
      await finish('send_error');
      return json({ error: 'Não foi possível enviar o código. Aguarde alguns segundos e tente novamente.',
        code: 'send_failed' }, 503);
    }
    const saved = await finish('sent');
    return json({ reused: false, rotated, expiresAt: saved.expiresAt });
  }
  try {
    if (input.action === 'request') return await requestCode();
    const state = await claim('verify');
    if (state.status === 'rotate') return await requestCode(true);
    if (state.status === 'expired') return json({
      error: 'O código expirou. Solicite um novo para continuar.', code: 'expired_code',
    }, 401);
    if (state.status === 'invalid') return json({
      error: 'Código incorreto. Confira os números recebidos por e-mail.', code: 'invalid_code',
    }, 401);
    if (state.status === 'busy') return json({ error: 'Aguarde a verificação em andamento e tente novamente.' }, 409);
    if (!['native', 'reuse'].includes(state.status)) throw new Error('state');

    let result;
    if (state.status === 'native') {
      result = await auth.verifyOtp({ email, token: code, type: 'email' });
    } else {
      // O hash já foi validado sob bloqueio no banco. Cria uma nova sessão
      // para a mesma identidade, sem enviar e-mail e sem prolongar o prazo.
      const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (error || !link?.properties?.hashed_token || link.user.id !== state.userId) throw new Error('identity');
      result = await auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    }
    if (result.error || !result.data.session) {
      if (state.status === 'native' && result.error?.code === 'otp_expired') {
        const saved = await finish('bad_code');
        if (saved.status === 'rotate') return await requestCode(true);
        return json({ error: 'Código incorreto ou expirado. Confira o e-mail.', code: 'invalid_code' }, 401);
      }
      throw new Error('verification');
    }
    const session = result.data.session;
    const saved = await finish('verified', session.user.id);
    if (saved.status === 'expired') {
      await auth.signOut({ scope: 'local' });
      return json({ error: 'O código expirou durante a verificação. Solicite outro.', code: 'expired_code' }, 401);
    }
    return json({ session: { access_token: session.access_token, refresh_token: session.refresh_token } });
  } catch {
    if (lease) {
      try { await finish(input.action === 'request' ? 'send_error' : 'server_error'); } catch { /* A reserva expira em 90 segundos. */ }
    }
    return json({ error: 'Não foi possível concluir o acesso agora. Tente novamente em instantes.' }, 503);
  }
}

