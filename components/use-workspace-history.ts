'use client';
import { useEffect, useRef } from 'react';

// Each workspace entry has its own snapshot. Never overwrite Next's history fields.
export type WorkspaceLocation = {
  view: string; current: string | null; modal: string | null;
  student: string | null; exam: string | null; recovery: string | null;
  share: string | null;
};
export function useWorkspaceHistory(scope: string, location: WorkspaceLocation,
  restore: (location: WorkspaceLocation) => void, ready: boolean) {
  const latest = useRef({ location, restore });
  latest.current = { location, restore };
  const last = useRef('');
  const mounted = useRef(false);
  const initialRender = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const existing = window.history.state?.provaai;
    if (existing?.scope === scope && existing.location) {
      initialRender.current = JSON.stringify(latest.current.location);
      last.current = JSON.stringify(existing.location);
      latest.current.restore(existing.location);
    } else {
      last.current = JSON.stringify(latest.current.location);
      window.history.replaceState({ ...window.history.state, provaai: { scope, location: latest.current.location } }, '');
    }
    mounted.current = true;
    const onPop = (event: PopStateEvent) => {
      const entry = event.state?.provaai;
      if (entry?.scope !== scope || !entry.location) return;
      last.current = JSON.stringify(entry.location);
      latest.current.restore(entry.location);
    };
    window.addEventListener('popstate', onPop);
    return () => { mounted.current = false; window.removeEventListener('popstate', onPop); };
  }, [scope, ready]);
  const serialized = JSON.stringify(location);
  useEffect(() => {
    if (!mounted.current) return;
    // On first mount a persisted entry is being restored; don't push the old render.
    if (initialRender.current === serialized) { initialRender.current = null; return; }
    initialRender.current = null;
    if (last.current === serialized) return;
    last.current = serialized;
    window.history.pushState({ ...window.history.state, provaai: { scope, location } }, '');
  }, [serialized, scope]);
}
