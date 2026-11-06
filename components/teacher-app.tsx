'use client';
import { useEffect, useState, useTransition } from 'react';
import AuthWelcome from './auth-welcome';
import ScreenLoader from './screen-loader';
import TeacherWorkspace from './teacher-workspace';
import { useIdleSession } from './use-idle-session';
import SessionWarning from './session-warning';

export default function TeacherApp() {
  const { ready, user, expired, warning, reportWork, continueSession } = useIdleSession();
  const [demo, setDemo] = useState(false);
  const [workspacePending, setWorkspacePending] = useState(false);
  const [navigating, startNavigation] = useTransition();

  useEffect(() => {
    if (user || expired) setDemo(false);
  }, [user, expired]);

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
              onWorkChange={reportWork}
              startNavigation={startNavigation}
            />
          ) : (
            <AuthWelcome sessionExpired={expired} onDemo={() => startNavigation(() => setDemo(true))} />
          ))}
      </div>
      <ScreenLoader active={loading} />
      {user && warning && <SessionWarning {...warning} onContinue={continueSession} />}
    </>
  );
}

