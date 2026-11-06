import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('lotes isolam professores, bloqueiam solicitações concorrentes e retomam uma reserva expirada', async () => {
  const db = new PGlite();
  const file = name => readFile(new URL('../'+name,import.meta.url),'utf8');
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid')::uuid $$;
      grant usage on schema auth to authenticated;`);
    const schema=await file('public/schema.sql');
    await db.exec(schema.slice(0,schema.indexOf('insert into storage.buckets'))+'commit;');
    await db.exec("alter table sala_templates add processing_status text default 'ready';");
    await db.exec(await file('supabase/migrations/20261105162821_teacher_template_defaults.sql'));
    await db.exec(await file('supabase/migrations/20261105220532_teacher_exam_batch.sql'));
    const accounts=[];
    for (let i=0;i<2;i++) {
      const user=randomUUID(),room=randomUUID(),student=randomUUID();
      await db.query('insert into auth.users values ($1)',[user]);
      await db.query("insert into sala_classes(id,user_id,name,grade,subject) values ($1,$2,'Turma','7','Ciências')",[room,user]);
      await db.query("insert into sala_students(id,user_id,class_id,name,code) values ($1,$2,$3,'Aluno','A')",[student,user,room]);
      accounts.push({user,room,student});
    }
    await db.exec('set role authenticated');
    const login=acct=>db.query("select set_config('test.uid',$1,false)",[acct.user]);
    const start=acct=>db.query('select sala_begin_exam_batch($1)',[JSON.stringify({classId:acct.room,students:[acct.student],title:'Teste',topics:'Ciências',count:2,objectiveCount:1,choice:'inherit'})]);
    const next=async()=>(await db.query('select sala_claim_exam_step() as work')).rows[0].work;
    await login(accounts[0]); await start(accounts[0]);
    await assert.rejects(start(accounts[0]),/andamento/);
    const a=await next(); assert.ok(a.examId);assert.equal(await next(),null);
    await login(accounts[1]); await start(accounts[1]);const b=await next();assert.notEqual(b.examId,a.examId);
    await db.exec('reset role');
    await db.query("update sala_exam_batches set lease_until=now()-interval '1 second' where user_id=$1",[accounts[0].user]);
    await db.exec('set role authenticated');await login(accounts[0]);
    const resumed=await next();assert.equal(resumed.examId,a.examId);assert.notEqual(resumed.lease,a.lease);
    await db.query('select sala_finish_exam_step($1,null)',[a.lease]);
    assert.equal(await next(),null);
    await db.query("select sala_finish_exam_step($1,'Teste de falha')",[resumed.lease]);
    assert.deepEqual((await db.query('select completed,failed from sala_exam_batches')).rows,[{completed:1,failed:1}]);
    await start(accounts[0]);
  } finally {await db.close();}
});
