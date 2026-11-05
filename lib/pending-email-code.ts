import type { SupabaseClient } from '@supabase/supabase-js';
import { requestEmailCode } from './email-auth.ts';

export const CODE_WINDOW_MS = 10 * 60 * 1000;
const inMemory = new Map<string, number>();

async function storageKey(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'provaai:otp:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readDeadline(key: string) {
  try {
    return Number(localStorage.getItem(key));
  } catch {
    return inMemory.get(key) ?? 0;
  }
}

function saveDeadline(key: string, deadline: number) {
  if (deadline) inMemory.set(key, deadline);
  else inMemory.delete(key);
  try {
    if (deadline) localStorage.setItem(key, String(deadline));
    else localStorage.removeItem(key);
  } catch {
    // O prazo continua disponível nesta aba quando o navegador bloqueia o armazenamento.
  }
}

export async function requestOrReuseCode(auth: SupabaseClient['auth'], email: string) {
  const address = email.trim().toLowerCase();
  const key = await storageKey(address);
  async function request() {
    const deadline = readDeadline(key);
    if (deadline > Date.now()) return { address, deadline, reused: true };
    try {
      await requestEmailCode(auth, address);
    } catch (error) {
      // A limitação por destinatário informa o prazo restante. Cotas globais
      // e falhas SMTP continuam sendo erros, sem confirmação de envio.
      const limit = error as { code?: string; message?: string };
      const wait = limit.code === 'over_email_send_rate_limit' &&
        /only request this after (\d+) seconds?/i.exec(limit.message ?? '');
      if (!wait) throw error;
      const seconds = Number(wait[1]);
      if (!seconds || seconds > CODE_WINDOW_MS / 1000) throw error;
      const until = Date.now() + seconds * 1000;
      saveDeadline(key, until);
      return { address, deadline: until, reused: true };
    }
    const until = Date.now() + CODE_WINDOW_MS;
    saveDeadline(key, until);
    return { address, deadline: until, reused: false };
  }
  return navigator.locks ? navigator.locks.request(key, request) : request();
}

export async function clearUsedCode(email: string) {
  saveDeadline(await storageKey(email), 0);
}
