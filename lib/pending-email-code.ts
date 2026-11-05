import { supabaseKey, supabaseUrl } from './supabase';

type CodeResult = {
  reused?: boolean;
  rotated?: boolean;
  expiresAt?: string;
  session?: { access_token: string; refresh_token: string };
};

export async function emailCodeRequest(action: 'request' | 'verify', email: string, code?: string): Promise<CodeResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/provaai-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey },
    body: JSON.stringify({ action, email: email.trim().toLowerCase(), code }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.error || 'Não foi possível concluir o acesso.'), {
      code: result.code, status: response.status,
    });
  }
  return result;
}

export async function requestOrReuseCode(email: string) {
  const result = await emailCodeRequest('request', email);
  const deadline = Date.parse(result.expiresAt ?? '');
  if (!Number.isFinite(deadline)) throw new Error('Solicite o código novamente.');
  return { address: email.trim().toLowerCase(), deadline, reused: result.reused === true };
}
