import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  requestEmailCode,
  verifyEmailCode,
  emailAuthError,
} from '../lib/email-auth.ts';

function fixture(response, status = 200) {
  const calls = [];
  const client = createClient('https://example.supabase.co', 'test-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) });
        return new Response(JSON.stringify(response), {
          status,
          headers: {
            'Content-Type': 'application/json',
            'X-Supabase-Api-Version': '2024-01-01',
          },
        });
      },
    },
  });
  return { auth: client.auth, calls };
}

test('request creates or accesses an account by email without a password or authenticated session', async () => {
  const { auth, calls } = fixture({});
  const email = await requestEmailCode(auth, ' Professor@Escola.com.br ');
  assert.equal(email, 'professor@escola.com.br');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/otp$/);
  assert.equal(calls[0].body.create_user, true);
  assert.equal(calls[0].body.email, email);
  assert.equal('password' in calls[0].body, false);
  assert.equal((await auth.getSession()).data.session, null);
});

test('only a verified email code establishes a session', async () => {
  const { auth, calls } = fixture({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'teacher-1', email: 'professor@escola.com.br' },
  });
  await verifyEmailCode(auth, 'professor@escola.com.br', ' 123456 ');
  assert.match(calls[0].url, /\/auth\/v1\/verify$/);
  assert.equal(calls[0].body.token, '123456');
  assert.equal(calls[0].body.type, 'email');
  assert.equal((await auth.getSession()).data.session.user.id, 'teacher-1');
});

test('expired code does not establish a session and yields a useful error', async () => {
  const { auth } = fixture(
    { code: 'otp_expired', msg: 'Token has expired or is invalid' },
    403,
  );
  await assert.rejects(
    verifyEmailCode(auth, 'professor@escola.com.br', '123456'),
    (err) => {
      assert.match(emailAuthError(err), /inválido ou expirado/);
      return true;
    },
  );
  assert.equal((await auth.getSession()).data.session, null);
});

test('invalid code format is rejected before a request, and missing session cannot count as login', async () => {
  const { auth, calls } = fixture({});
  await assert.rejects(
    verifyEmailCode(auth, 'professor@escola.com.br', 'abc123'),
    /código numérico/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    verifyEmailCode(
      { verifyOtp: async () => ({ data: { session: null }, error: null }) },
      'professor@escola.com.br',
      '123456',
    ),
    /iniciar sua sessão/,
  );
});

test('SMTP rate limits are surfaced without treating the email as delivered', async () => {
  const { auth } = fixture(
    { code: 'over_email_send_rate_limit', msg: 'Rate limit exceeded' },
    429,
  );
  await assert.rejects(
    requestEmailCode(auth, 'professor@escola.com.br'),
    (err) => {
      assert.match(emailAuthError(err), /limite de envios/);
      return true;
    },
  );
});
