'use client';

import { useEffect, useRef, useState } from 'react';
import type { DownloadProgress } from '@/lib/export';

export function useExamDownload() {
  const running = useRef(false);
  const live = useRef(true);
  const [status, setStatus] = useState<DownloadProgress | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    live.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (running.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { live.current = false; window.removeEventListener('beforeunload', beforeUnload); };
  }, []);

  async function start(total: number, work: (report: (progress: DownloadProgress) => void) => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setStatus({ completed: 0, total, percent: 0, label: 'Preparando a prova' });
    setNotice('');
    setError('');
    try {
      await work(progress => { if (live.current) setStatus(progress); });
      if (live.current) setNotice('Arquivo pronto! Confira os downloads do navegador.');
    } catch (error) {
      if (live.current) setError(error instanceof Error ? error.message : 'Não foi possível preparar o download. Tente novamente.');
    } finally {
      running.current = false;
      if (live.current) setStatus(null);
    }
  }

  return { status, busy: status !== null, running, notice, error, start,
    dismiss: () => { setNotice(''); setError(''); } };
}
