import { apiFetch } from './api-client';

type CodeResult = {
  reused?: boolean;
  rotated?: boolean;
  expiresAt?: string;
  session?: { access_token: string; refresh_token: string };
};

export async function emailCodeRequest(action: 'request' | 'verify', email: string, code?: string): Promise<CodeResult> {
  const response = await apiFetch('/api/auth/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
