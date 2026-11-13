'use client';
import { useCallback, useEffect, useRef } from 'react';

export type WorkspacePage = { view: string; current: string | null };
type WorkspaceLocation = WorkspacePage & { modal: string | null };

// Forms and progress dialogs are transient. Back/Forward restore pages, never drafts.
function pageOf(location: WorkspacePage): WorkspacePage {
  return {
    view: location.view === 'settings' ? 'about' : location.view,
    current: location.view === 'classes' || location.view === 'exams' ? location.current : null,
  };
}

export function useWorkspaceHistory(scope: string, location: WorkspaceLocation,
  restore: (location: WorkspacePage) => void, ready: boolean) {
  const latest = useRef({ location, restore });
  latest.current = { location, restore };
  const last = useRef('');
  const mounted = useRef(false);
  const initialRender = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const existing = window.history.state?.provaai;
    if (existing?.scope === scope && existing.location) {
      initialRender.current = JSON.stringify(pageOf(latest.current.location));
      const page = pageOf(existing.location);
      last.current = JSON.stringify(page);
      // Also sanitize entries saved by older versions that included open forms.
      window.history.replaceState({ ...window.history.state, provaai: { scope, location: page } }, '');
      latest.current.restore(page);
    } else {
      const page = pageOf(latest.current.location);
      last.current = JSON.stringify(page);
      window.history.replaceState({ ...window.history.state, provaai: { scope, location: page } }, '');
    }
    mounted.current = true;
    const onPop = (event: PopStateEvent) => {
      const entry = event.state?.provaai;
      if (entry?.scope !== scope || !entry.location) return;
      const page = pageOf(entry.location);
      last.current = JSON.stringify(page);
      window.history.replaceState({ ...window.history.state, provaai: { scope, location: page } }, '');
      latest.current.restore(page);
    };
    window.addEventListener('popstate', onPop);
    return () => { mounted.current = false; window.removeEventListener('popstate', onPop); };
  }, [scope, ready]);
  const serialized = JSON.stringify(pageOf(location));
  useEffect(() => {
    if (!mounted.current || location.modal) return;
    // On first mount a persisted entry is being restored; don't push the old render.
    if (initialRender.current === serialized) { initialRender.current = null; return; }
    initialRender.current = null;
    if (last.current === serialized) return;
    last.current = serialized;
    window.history.pushState({ ...window.history.state, provaai: { scope, location: JSON.parse(serialized) } }, '');
  }, [serialized, scope, location.modal]);

  // Opening a form can select a resource without navigating to its page.
  // Cancel/close returns to the page where the form was opened.
  return useCallback(() => {
    if (last.current) latest.current.restore(JSON.parse(last.current));
  }, []);
}
