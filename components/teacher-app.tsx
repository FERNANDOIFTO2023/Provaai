'use client';
import { useEffect, useState, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import AuthWelcome from './auth-welcome';
import ScreenLoader from './screen-loader';
import TeacherWorkspace, { type Teacher } from './teacher-workspace';

export default function TeacherApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Teacher | null>(null);
  const [demo, setDemo] = useState(false);
  const [workspacePending, setWorkspacePending] = useState(false);
  const [navigating, startNavigation] = useTransition();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session || event === 'SIGNED_OUT') setDemo(false);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const inWorkspace = !!user || demo;
  const loading = !ready || (inWorkspace && workspacePending) || navigating;
  return (
    <>
      <div inert={loading} aria-busy={loading}>
        {ready &&
          (inWorkspace ? (
            <TeacherWorkspace
              key={user?.id ?? 'demo'}
              user={user}
              demo={demo}
              leaveDemo={() => setDemo(false)}
              onPendingChange={setWorkspacePending}
              startNavigation={startNavigation}
            />
          ) : (
            <AuthWelcome onDemo={() => startNavigation(() => setDemo(true))} />
          ))}
      </div>
      <ScreenLoader active={loading} />
    </>
  );
}

