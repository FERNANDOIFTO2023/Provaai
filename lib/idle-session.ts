export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;
export const ACTIVITY_PREFIX = 'provaai:activity:v1:';

export type Activity = { lastActivity: number; ended: boolean };
export type ActivityStorage = Pick<Storage, 'getItem' | 'setItem'>;
const memory = new Map<string, string>();
const storageFailed = new Set<string>();

// A identidade apenas associa o relógio à sessão. A autenticação continua no Supabase.
export function activityKey(accessToken: string): string | null {
  try {
    const segment = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(segment));
    if (typeof claims.sub !== 'string' || typeof claims.session_id !== 'string') return null;
    return ACTIVITY_PREFIX + claims.sub + ':' + claims.session_id;
  } catch { return null; }
}

function browserStorage(): ActivityStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readActivity(key: string, storage = browserStorage()): Activity | null {
  try {
    let raw: string | null | undefined;
    try { raw = storage && !storageFailed.has(key) ? storage.getItem(key) : memory.get(key); }
    catch { raw = memory.get(key); }
    const value = JSON.parse(raw || 'null');
    return value && Number.isFinite(value.lastActivity) && typeof value.ended === 'boolean' ? value : null;
  } catch { return null; }
}

export function writeActivity(key: string, value: Activity, storage = browserStorage()) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { storage?.setItem(key, raw); storageFailed.delete(key); }
  catch { storageFailed.add(key); }
}

export function beginVerifiedSession(accessToken: string, now = Date.now()) {
  const key = activityKey(accessToken);
  if (!key) throw new Error('Não foi possível identificar a sessão. Solicite o código novamente.');
  writeActivity(key, { lastActivity: now, ended: false });
}

export function idleStatus(activity: Activity | null, now: number, working = false) {
  // Um registro ausente, encerrado ou inválido nunca autoriza restaurar a conta.
  if (!activity || activity.ended || activity.lastActivity > now || activity.lastActivity <= 0)
    return { phase: 'expired' as const, remaining: 0 };
  const remaining = Math.max(0, activity.lastActivity + IDLE_LIMIT_MS - now);
  const phase = remaining === 0 ? (working ? 'deferred' : 'expired')
    : remaining <= IDLE_WARNING_MS ? 'warning' : 'active';
  return { phase, remaining };
}
