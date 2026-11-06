'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, Sparkles } from './animated-icons';
import EmailLogin from './email-login';
import BloubMascot, { type MascotHandle } from './bloub-mascot';

export default function AuthWelcome({ onDemo, sessionExpired = false }: { onDemo: () => void; sessionExpired?: boolean }) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const mascot = useRef<MascotHandle>(null);
  return (
    <main className="auth-shell" data-login-stage={stage}>
      <section className="auth-story" aria-label="Boas-vindas à Provaai">
        <a className="brand" href="/" aria-label="Provaai, início">
          <img src="/bloub/bloub-symbol.svg" alt="" width="42" height="42" />
          Provaai<span className="brand-dot">.</span>
        </a>
        <div className="auth-intro">
          <h1>
            Cada aluno,
            <br />
            uma <span>possibilidade.</span>
          </h1>
          <figure className="mascot-figure">
            <div className="mascot-stage">
              <div className="mascot-orbit orbit-one" aria-hidden="true" />
              <div className="mascot-orbit orbit-two" aria-hidden="true" />
              <span className="mascot-spark spark-one" aria-hidden="true">
                ✦
              </span>
              <span className="mascot-spark spark-two" aria-hidden="true">
                ✧
              </span>
              <BloubMascot ref={mascot} happy={stage === 'code'} />
            </div>
            <figcaption className="mascot-caption">
              <span className="caption-dot" />
              {stage === 'code'
                ? 'Um código, e a sua Provaai se abre.'
                : 'Um olhar atento faz toda a diferença.'}
            </figcaption>
          </figure>
        </div>
      </section>
      <section className="auth-side" aria-label="Acesso do professor">
        <div className="auth-form">
          {sessionExpired && <p className="session-expired-note" role="status">Sua sessão foi encerrada por inatividade. Entre novamente com seu e-mail.</p>}
          <EmailLogin
            onStageChange={setStage}
            onRejected={() => mascot.current?.shakeHead()}
          />
          <div className="divider">
            <span>OU</span>
          </div>
          <button
            type="button"
            className="button secondary full demo-button"
            onClick={onDemo}
          >
            <Sparkles size={17} />
            Explorar demonstração
            <ArrowUpRight size={17} />
          </button>
          <small className="auth-note">
            Um passeio com dados fictícios, sem cadastro.
          </small>
        </div>
      </section>
    </main>
  );
}
