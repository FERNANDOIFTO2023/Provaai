import { useEffect, useRef, useState } from 'react';

type Stage = 'queued' | 'uploading' | 'reading' | 'ready' | 'failed';
export type TemplateTask = { id: string; name: string; stage: Stage; error?: string };
type Work = {
  id: string;
  name: string;
  run: (report: (stage: 'uploading' | 'reading') => void, signal: AbortSignal) => Promise<void>;
};

export function useTemplateQueue() {
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const pending = useRef<Work[]>([]);
  const inFlight = useRef(new Map<string, AbortController>());
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const running = inFlight.current;
    return () => {
      live.current = false;
      pending.current = [];
      for (const controller of running.values()) controller.abort();
    };
  }, []);

  async function run(job: Work) {
    const controller = new AbortController();
    inFlight.current.set(job.id, controller);
    function update(stage: Stage, error?: string) {
      if (live.current) setTasks(list => list.map(t => t.id === job.id ? { ...t, stage, error } : t));
    }
    try {
      await job.run(update, controller.signal);
      update('ready');
    } catch (err) {
      update('failed', (err as Error)?.message || 'Falha ao anexar o modelo.');
    } finally {
      inFlight.current.delete(job.id);
      pump();
    }
  }
  function pump() {
    while (live.current && inFlight.current.size < 2 && pending.current.length) {
      void run(pending.current.shift()!);
    }
  }
  function enqueue(jobs: Work[]) {
    const fresh = jobs.filter(job => !inFlight.current.has(job.id) && !pending.current.some(t => t.id === job.id));
    if (!fresh.length) return;
    setTasks(list => [
      ...list.filter(t => t.stage !== 'ready' && !fresh.some(job => job.id === t.id)),
      ...fresh.map(({id, name}) => ({id, name, stage: 'queued' as const})),
    ]);
    pending.current.push(...fresh);
    pump();
  }
  const active = tasks.filter(t => t.stage !== 'ready' && t.stage !== 'failed');
  return { tasks, active, enqueue, dismiss: () => setTasks(list => list.filter(t => t.stage !== 'failed' && t.stage !== 'ready')) };
}
