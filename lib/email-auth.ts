import type { SupabaseClient } from '@supabase/supabase-js';

type EmailAuth = Pick<SupabaseClient['auth'], 'signInWithOtp' | 'verifyOtp'>;

export async function requestEmailCode(auth: EmailAuth, email: string) {
  const address = email.trim().toLowerCase();
  const { error } = await auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return address;
}

export async function verifyEmailCode(
  auth: EmailAuth,
  email: string,
  code: string,
) {
  const token = code.trim();
  if (!/^\d{6,10}$/.test(token))
    throw new Error('Digite o código numérico recebido por e-mail.');
  const { data, error } = await auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (!data.session)
    throw new Error(
      'Não foi possível iniciar sua sessão. Solicite um novo código.',
    );
}

export function isRejectedCode(error: unknown) {
  const item = error as { code?: string; message?: string } | null;
  return (
    item?.code === 'invalid_code' ||
    item?.code === 'expired_code' ||
    item?.code === 'otp_expired' ||
    /token has expired or is invalid/i.test(item?.message ?? '')
  );
}

export function emailAuthError(error: unknown) {
  const item = error as {
    code?: string;
    status?: number;
    message?: string;
  } | null;
  if (['invalid_code', 'expired_code', 'send_failed', 'send_limit'].includes(item?.code ?? ''))
    return item?.message || 'Não foi possível concluir o acesso.';
  if (isRejectedCode(error) || item?.code === 'otp_disabled')
    return 'Código inválido ou expirado. Confira o código ou solicite um novo.';
  if (item?.status === 429 || item?.code === 'over_email_send_rate_limit')
    return 'Aguarde um pouco antes de solicitar outro código. O limite de envios foi atingido.';
  if (
    item?.code === 'email_address_invalid' ||
    item?.code === 'validation_failed'
  )
    return 'Confira o endereço de e-mail informado.';
  if (item?.status && item.status >= 500)
    return 'O serviço de acesso não conseguiu concluir a solicitação. Tente novamente em instantes.';
  if (error instanceof TypeError || item?.message?.includes('fetch'))
    return 'Não foi possível conectar. Confira sua internet e tente novamente.';
  if (error instanceof Error && !item?.code && !item?.status)
    return error.message;
  return 'Não foi possível concluir o acesso. Confira os dados e tente novamente.';
}
