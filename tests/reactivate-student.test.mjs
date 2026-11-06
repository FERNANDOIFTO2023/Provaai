import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {demoData} from '../lib/model.ts';
import {individualStudents} from '../lib/exam-library.ts';

test('inativos incluem alunos fora das provas individuais; ativos exigem vínculo', () => {
  const data=demoData();
  const [a,b,c]=data.students;
  const students=[a,b,{...c,archived_at:new Date().toISOString()}];
  assert.deepEqual(individualStudents(students,data.classes,[a.id],false,'').map(s=>s.id),[a.id]);
  assert.deepEqual(individualStudents(students,data.classes,[],true,'').map(s=>s.id),[c.id]);
  assert.equal(individualStudents(students,data.classes,[],true,'inexistente').length,0);
  assert.equal(individualStudents(students,data.classes,[],true,c.code).length,1);
});

test('reativação transfere o vínculo, preserva provas e códigos históricos e isola professores', async () => {
  const db=new PGlite();
  const file=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to authenticated;`);
    const schema=await file('public/schema.sql');
    await db.exec(schema.slice(0,schema.indexOf('insert into storage.buckets'))+'commit;');
    await db.exec("alter table sala_templates add processing_status text default 'ready';");
    for(const migration of ['20261105162821_teacher_template_defaults.sql','20261105220532_teacher_exam_batch.sql','20261105235000_recovery_and_archived_students.sql','20261106161318_reactivate_student_in_class.sql'])
      await db.exec(await file('supabase/migrations/'+migration));
    const user=randomUUID(),otherUser=randomUUID(),oldRoom=randomUUID(),newRoom=randomUUID(),otherRoom=randomUUID(),student=randomUUID(),otherStudent=randomUUID(),exam=randomUUID();
    await db.query('insert into auth.users values($1),($2)',[user,otherUser]);
    for(const [room,owner] of [[oldRoom,user],[newRoom,user],[otherRoom,otherUser]])
      await db.query("insert into sala_classes(id,user_id,name,grade,subject) values($1,$2,'Turma','7','Matemática')",[room,owner]);
    for(const [id,owner,room,code] of [[student,user,oldRoom,'A001'],[randomUUID(),user,newRoom,'A001'],[randomUUID(),user,newRoom,'A009'],[otherStudent,otherUser,otherRoom,'A001']])
      await db.query("insert into sala_students(id,user_id,class_id,name,code) values($1,$2,$3,'Aluno',$4)",[id,owner,room,code]);
    await db.query("update sala_students set archived_at=now() where class_id=$1 and code='A009'",[newRoom]);
    const content={questions:[{statement:'Questão original',answer:'Resposta original'}]};
    await db.query("insert into sala_exams(id,user_id,class_id,student_id,title,subject,topics,question_count,status,content,profile_snapshot) values($1,$2,$3,$4,'Prova antiga','Matemática','Frações',1,'approved',$5,$6)",
      [exam,user,oldRoom,student,JSON.stringify(content),JSON.stringify({name:'Aluno',code:'A001'})]);
    await db.query('update sala_students set archived_at=now() where id in ($1,$2)',[student,otherStudent]);
    await db.exec('set role authenticated');
    await db.query("select set_config('test.uid',$1,false)",[user]);
    const restore=(id,room)=>db.query('select * from sala_reactivate_student($1,$2)',[id,room]);
    await assert.rejects(restore(student,otherRoom),/turma da sua conta/);
    await assert.rejects(restore(otherStudent,newRoom),/Aluno não encontrado/);
    assert.equal((await db.query('select archived_at from sala_students where id=$1',[student])).rows[0].archived_at!==null,true);
    const restored=(await restore(student,newRoom)).rows[0];
    assert.equal(restored.id,student);assert.equal(restored.class_id,newRoom);assert.equal(restored.code,'A010');assert.equal(restored.archived_at,null);
    const historical=(await db.query('select * from sala_exams where id=$1',[exam])).rows[0];
    assert.equal(historical.class_id,oldRoom);assert.equal(historical.profile_snapshot.code,'A001');assert.equal(historical.status,'approved');assert.deepEqual(historical.content,content);
    assert.equal((await db.query('select * from sala_recovery_students where student_id=$1',[student])).rows.length,1);
    await assert.rejects(restore(student,newRoom),/já está ativo/);
    await assert.rejects(db.query('update sala_students set class_id=$1 where id=$2',[oldRoom,student]),/Retire o aluno/);
    await db.query("update sala_exams set title='Revisão posterior' where id=$1",[exam]);
    assert.equal((await db.query('select class_id from sala_exams where id=$1',[exam])).rows[0].class_id,oldRoom);
    await assert.rejects(db.query('insert into sala_generation_jobs(exam_id) values($1)',[exam]),/turma atual/);
    await db.query('update sala_students set archived_at=now() where id=$1',[student]);
    assert.equal((await restore(student,newRoom)).rows[0].code,'A010');
    const input={classId:newRoom,students:[student],title:'Nova prova',topics:'Frações',count:1,objectiveCount:0,choice:'builtin',purpose:'recovery'};
    await db.query('select sala_begin_exam_batch($1)',[JSON.stringify(input)]);
    await assert.rejects(db.query('update sala_students set archived_at=now() where id=$1',[student]),/Aguarde a geração/);
    const row=(await db.query("select * from sala_exams where title='Nova prova'")).rows[0];
    assert.equal(row.class_id,newRoom);assert.equal(row.profile_snapshot.code,'A010');
    await db.query("select set_config('test.uid',$1,false)",[otherUser]);
    assert.equal((await db.query('select * from sala_exams')).rows.length,0);
    await assert.rejects(restore(student,otherRoom),/Aluno não encontrado/);
    await db.exec('reset role; set role anon');
    await assert.rejects(restore(student,oldRoom),/permission denied/);
  } finally {await db.close();}
});
