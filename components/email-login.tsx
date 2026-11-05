'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  emailAuthError,
  isRejectedCode,
  verifyEmailCode,
} from '@/lib/email-auth';

import { clearUsedCode, requestOrReuseCode } from '@/lib/pending-email-code';

export default function EmailLogin({
  onStageChange,
  onRejected,
}: {
  onStageChange?: (stage: 'email' | 'code') => void;
  onRejected: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const showCodeHelp = !!sentTo && remaining === 0;
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!retryAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  useEffect(() => {
    if (sentTo) codeInput.current?.focus();
  }, [sentTo]);
  useEffect(() => {
    onStageChange?.(sentTo ? 'code' : 'email');
  }, [sentTo, onStageChange]);

  function rejectInput(reason: string) {
    setInvalid(true);
    setMessage('');
    setError(reason);
    onRejected();
  }

  function editInput() {
    if (invalid) {
      setInvalid(false);
      setError('');
    }
  }

  async function run(task: () => Promise<void>, verifying = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setInvalid(false);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (err) {
      if (verifying && isRejectedCode(err)) rejectInput(emailAuthError(err));
      else setError(emailAuthError(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function send() {
    await run(async () => {
      const { address, deadline, reused } = await requestOrReuseCode(supabase.auth, sentTo || email);
      setRetryAt(deadline);
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setSentTo(address);
      setCode('');
      setMessage(reused
        ? 'Use o código anterior enviado para este e-mail.'
        : 'Código enviado por e-mail. Verifique a caixa de entrada ou o spam.');
      codeInput.current?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) {
      await send();
      return;
    }
    await run(async () => {
      await verifyEmailCode(supabase.auth, sentTo, code);
      await clearUsedCode(sentTo);
    }, true);
  }

  return (
    <>
      <h2>{sentTo ? 'Confira seu e-mail.' : 'Bom ter você por aqui.'}</h2>
      <p>
        {sentTo ? (
          <>
            Digite o código enviado para <strong>{sentTo}</strong>.
          </>
        ) : (
          'Use seu e-mail para entrar ou criar uma conta. Enviaremos um código de acesso.'
        )}
      </p>
      <form
        onSubmit={submit}
        aria-busy={busy}
        onInvalid={(event) => {
          event.preventDefault();
          const field = event.target;
          if (!(field instanceof HTMLInputElement)) return;
          field.focus();
          rejectInput(
            sentTo
              ? 'Digite o código numérico recebido por e-mail.'
              : field.validity.valueMissing
                ? 'Informe seu e-mail para receber o código.'
                : 'Confira o endereço de e-mail informado.',
          );
        }}
      >
        {!sentTo ? (
          <label className="field">
            <span>E-mail do professor</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="voce@escola.com.br"
              value={email}
              onChange={(e) => {
                editInput();
                setEmail(e.target.value);
              }}
              required
              disabled={busy}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'login-error' : undefined}
            />
          </label>
        ) : (
          <label className="field">
            <span>Código de acesso</span>
            <input
              ref={codeInput}
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              minLength={6}
              maxLength={10}
              placeholder="Digite o código recebido"
              value={code}
              onChange={(e) => {
                editInput();
                setCode(e.target.value.replace(/\s/g, ''));
              }}
              required
              readOnly={busy}
              aria-invalid={invalid}
              aria-describedby={
                [showCodeHelp && 'code-help', invalid && 'login-error']
                  .filter(Boolean).join(' ') || undefined
              }
            />
          </label>
        )}
        {sentTo && showCodeHelp && (
          <small id="code-help">
            Use o código mais recente. Confira também o spam.
          </small>
        )}
        {error && (
          <p id="login-error" className="error" role="alert">
            {error}
          </p>
        )}
        {message && !showCodeHelp && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <button
          className="button primary full"
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="spin" size={18} /> Aguarde…
            </>
          ) : (
            <>
              {sentTo
                ? 'Entrar na minha Provaai'
                : 'Receber código por e-mail'}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
      {sentTo && (
        <div className="auth-links">
          <button
            type="button"
            disabled={busy || remaining > 0}
            onClick={() => void send()}
          >
            {remaining > 0
              ? `Reenviar em ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
              : 'Reenviar código'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSentTo('');
              setRetryAt(0);
              setRemaining(0);
              setCode('');
              setInvalid(false);
              setError('');
              setMessage('');
            }}
          >
            Alterar e-mail
          </button>
        </div>
      )}
    </>
  );
}
