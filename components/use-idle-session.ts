'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@/lib/api-client';
import { apiClient } from '@/lib/api-client';
import { activityKey, idleStatus, readActivity, writeActivity } from '@/lib/idle-session';

export function useIdleSession() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [expired, setExpired] = useState(false);
  const [warning, setWarning] = useState<{ remaining: number; deferred: boolean } | null>(null);
  const keyRef = useRef<string | null>(null);
  const workRef = useRef(false);
  const checkRef = useRef<() => void>(() => {});
  const renewRef = useRef<() => void>(() => {});
  const reportWork = useCallback((working: boolean) => {
    workRef.current = working;
    checkRef.current();
  }, []);
  const continueSession = useCallback(() => renewRef.current(), []);

  useEffect(() => {
    let mounted = true;
    let logoutTimer: ReturnType<typeof setTimeout> | undefined;
    let lastWrite = 0;

    function expire() {
      const key = keyRef.current;
      if (key) writeActivity(key, { lastActivity: Date.now(), ended: true });
      keyRef.current = null;
      workRef.current = false;
      setWarning(null);
      setUser(null);
      setExpired(true);
      setReady(true);
      // O callback de autenticação é síncrono: sair fora dele evita o lock do SDK.
      clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        if (!keyRef.current) void apiClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }, 0);
    }

    function check() {
      const key = keyRef.current;
      if (!key) return;
      const state = idleStatus(readActivity(key), Date.now(), workRef.current);
      if (state.phase === 'expired') { expire(); return; }
      setWarning(state.phase === 'active' ? null : {
        remaining: Math.ceil(state.remaining / 1000), deferred: state.phase === 'deferred',
      });
    }

    function renew(explicit = false) {
      const key = keyRef.current;
      if (!key) return;
      const now = Date.now();
      const state = idleStatus(readActivity(key), now, workRef.current);
      // Voltar à aba ou clicar após o prazo não recupera uma sessão encerrada.
      if (state.phase === 'expired') { expire(); return; }
      if (!explicit && state.phase !== 'active') { check(); return; }
      if (explicit || now - lastWrite >= 1000) {
        writeActivity(key, { lastActivity: now, ended: false });
        lastWrite = now;
        setWarning(null);
      }
    }

    checkRef.current = check;
    renewRef.current = () => renew(true);
    const { data: { subscription } } = apiClient.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session) {
        const key = keyRef.current;
        if (key) writeActivity(key, { lastActivity: Date.now(), ended: true });
        keyRef.current = null;
        workRef.current = false;
        setUser(null);
        setWarning(null);
        setReady(true);
        return;
      }
      const key = activityKey(session.access_token);
      const sameSession = key !== null && key === keyRef.current;
      const state = idleStatus(key ? readActivity(key) : null, Date.now(), sameSession && workRef.current);
      keyRef.current = key;
      if (state.phase === 'expired') { expire(); return; }
      if (!sameSession) workRef.current = false;
      setUser(session.user);
      setExpired(false);
      setReady(true);
      check();
    });

    const interact = (event: Event) => {
      if (event.isTrusted && document.visibilityState === 'visible') renew();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll'] as const;
    for (const event of events) window.addEventListener(event, interact, { capture: true, passive: true });
    const checkVisible = () => { if (document.visibilityState === 'visible') check(); };
    const sync = (event: StorageEvent) => {
      if (event.key === keyRef.current || event.key === null) check();
    };
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    window.addEventListener('storage', sync);
    document.addEventListener('visibilitychange', checkVisible);
    const timer = setInterval(check, 1000);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(timer);
      clearTimeout(logoutTimer);
      checkRef.current = () => {};
      renewRef.current = () => {};
      for (const event of events) window.removeEventListener(event, interact, true);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('storage', sync);
      document.removeEventListener('visibilitychange', checkVisible);
    };
  }, []);

  return { ready, user, expired, warning, reportWork, continueSession };
}
