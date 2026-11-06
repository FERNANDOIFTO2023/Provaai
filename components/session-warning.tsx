'use client';

import { useEffect, useRef } from 'react';
import { BloubMood } from './motion';

export default function SessionWarning({ remaining, deferred, onContinue }: {
  remaining: number; deferred: boolean; onContinue: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="dialog session-warning" aria-labelledby="session-warning-title"
    aria-describedby="session-warning-description" onCancel={event => event.preventDefault()}>
    <BloubMood mood="sonolento" />
    <h2 id="session-warning-title">Você ainda está por aqui?</h2>
    <p id="session-warning-description">{deferred
      ? 'Há uma tarefa em andamento. Vamos aguardar sua conclusão e encerrar a sessão por inatividade. Para continuar usando o site, confirme abaixo.'
      : 'Sua sessão será encerrada após 30 minutos sem interação. Para continuar, confirme abaixo.'}</p>
    {!deferred && <p className="session-countdown">Encerramento em {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>}
    <button type="button" className="button primary" onClick={onContinue} autoFocus>Continuar conectado</button>
  </dialog>;
}
