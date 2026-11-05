import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handleCode } from '../supabase/functions/provaai-auth/handler.ts';

test('código reutilizável com expiração, isolamento, concorrência e substituição após cinco erros', async t => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, recovery_sent_at timestamptz, confirmation_sent_at timestamptz, is_sso_user boolean default false, deleted_at timestamptz);");
    const id = '11111111-1111-4111-8111-111111111111';
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [id,'professor@example.test']);
    await db.exec(await readFile(new URL('../supabase/migrations/20261105000000_reusable_email_codes.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261105000100_email_code_delivery.sql', import.meta.url), 'utf8'));
    const settings = {url:'https://auth.example.test', publicKey:'public-test', serviceKey:'server-test'};
    let currentCode = '123456', sends = 0, links = 0, failSend = false, pauseSend;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      const path = new URL(String(url)).pathname, body = JSON.parse(init.body);
      if (path.includes('/rest/v1/rpc/')) {
        const name = path.split('/').pop();
        const keys = Object.keys(body);
        const query = 'select public.' + name + '(' + keys.map((key,i)=>key+' => $'+(i+1)).join(',') + ') as value';
        try {
          const result = await db.query(query, keys.map(key=>body[key]));
          return Response.json(result.rows[0].value);
        } catch (error) {
          return Response.json({message:String(error)}, {status:400});
        }
      }
      if (path.endsWith('/otp')) {
        const user = await db.query("select 1 from auth.users where email=$1 and recovery_sent_at > now()-interval '10 minutes'", [body.email]);
        if (user.rows.length) return Response.json({code:'over_email_send_rate_limit',msg:'For security purposes, you can only request this after 599 seconds.'}, {status:429,headers:{'X-Supabase-Api-Version':'2024-01-01'}});
        await db.query('update auth.users set recovery_sent_at=now() where email=$1', [body.email]);
        sends++;
        if(pauseSend) await pauseSend;
        if(failSend) return Response.json({code:'over_email_send_rate_limit',msg:'test failure'}, {status:429});
        currentCode = String(100000+sends);
        return Response.json({});
      }
      if (path.endsWith('/admin/generate_link')) {
        links++;
        return Response.json({id,email:'professor@example.test',hashed_token:'hash-'+links,verification_type:'magiclink'});
      }
      if (path.endsWith('/verify')) {
        if(body.token !== currentCode && !String(body.token_hash).startsWith('hash-'))
          return Response.json({code:'otp_expired',msg:'Invalid token'}, {status:403,headers:{'X-Supabase-Api-Version':'2024-01-01'}});
        currentCode = ''; // O provedor consome o código nativo no primeiro login.
        return Response.json({access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600,token_type:'bearer',user:{id,email:'professor@example.test'}});
      }
      if(path.endsWith('/logout')) return new Response(null, {status:204});
      throw new Error('Unexpected request '+path);
    });
    async function call(action, code, email='professor@example.test') {
      const response = await handleCode(new Request('https://local.test', {method:'POST',body:JSON.stringify({action,email,code})}), settings);
      return {status:response.status,body:await response.json()};
    }
    await t.test('privacidade: roles públicas não leem registros nem executam RPC', async()=>{
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from public.provaai_email_codes'),/permission denied/);
      await assert.rejects(db.query("select public.provaai_code_claim(repeat('a',64),'request',null)"),/permission denied/);
      await db.exec('reset role');
    });
    let firstCode, initialDeadline;
    await t.test('o pedido repetido reaproveita o prazo e envia um único e-mail', async()=>{
      const a=await call('request'); assert.equal(a.status,200); firstCode=currentCode; initialDeadline=a.body.expiresAt;
      const b=await call('request',undefined,' PROFESSOR@example.test ');assert.equal(b.body.reused,true);
      assert.equal(b.body.expiresAt,initialDeadline);assert.equal(sends,1);
    });
    await t.test('primeiro login e dois reusos geram sessões, com prazo original', async()=>{
      assert.ok((await call('verify',firstCode)).body.session);
      assert.ok((await call('verify',firstCode)).body.session);
      assert.ok((await call('verify',firstCode)).body.session);
      assert.equal(links,2);
      assert.equal((await call('request')).body.expiresAt,initialDeadline);
    });
    await t.test('cinco erros substituem o código imediatamente e revogam o anterior', async()=>{
      for(let i=0;i<4;i++) assert.equal((await call('verify','000000')).status,401);
      const fifth=await call('verify','000000');
      assert.equal(fifth.body.rotated,true,JSON.stringify(fifth));assert.equal(sends,2);
      const next=currentCode;
      assert.equal((await call('verify',firstCode)).status,401);
      assert.ok((await call('verify',next)).body.session);
      firstCode=next;
    });
    await t.test('outro destinatário não herda o código', async()=>{
      assert.equal((await call('verify',firstCode,'outro@example.test')).status,401);
    });
    await t.test('expiração no servidor bloqueia mesmo após login válido', async()=>{
      await db.exec("update public.provaai_email_codes set expires_at = now() - interval '1 second'");
      assert.equal((await call('verify',firstCode)).body.code,'expired_code');
      await db.exec("update public.provaai_email_codes set retry_at = '-infinity'");
      assert.equal((await call('request')).body.reused,false);
    });
    await t.test('erros na primeira verificação nativa também substituem na quinta tentativa', async()=>{
      for(let i=0;i<4;i++) assert.equal((await call('verify','999999')).status,401);
      const fifth=await call('verify','999999');
      assert.equal(fifth.body.rotated,true,JSON.stringify(fifth));
    });
    await t.test('falha de envio nunca é informada como sucesso', async()=>{
      failSend=true;
      const result=await call('request',undefined,'falha@example.test');
      assert.equal(result.status,503);assert.equal(result.body.code,'send_failed');assert.equal(result.body.rotated,undefined);
      failSend=false;
    });
    await t.test('reserva impede envio duplicado com chamadas simultâneas', async()=>{
      let release; pauseSend=new Promise(resolve=>{release=resolve});
      const before=sends;
      const sending=call('request',undefined,'simultaneo@example.test');
      while(sends===before) await new Promise(resolve=>setTimeout(resolve,5));
      const second=await call('request',undefined,'simultaneo@example.test');
      assert.equal(second.status,409);release();await sending;pauseSend=undefined;
    });
    await t.test('limite por endereço impede ciclos ilimitados de substituição', async()=>{
      await db.exec("update public.provaai_email_codes set failures=5,sends=6,expires_at=now()+interval '10 minutes'");
      assert.equal((await call('verify','000000')).status,429);
    });
  } finally { await db.close(); }
});

