import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('cada professor só pode escolher modelos próprios, e as turmas podem seguir ou substituir seu padrão', async () => {
  const db = new PGlite();
  const teacher = randomUUID(), other = randomUUID();
  const room = randomUUID(), secondRoom = randomUUID();
  const template = randomUUID(), alternate = randomUUID(), foreign = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select current_setting('test.uid')::uuid $$;
      grant usage on schema auth to authenticated;`);
    const initial = await readFile(new URL('../public/schema.sql', import.meta.url), 'utf8');
    await db.exec(initial.slice(0, initial.indexOf('insert into storage.buckets')) + 'commit;');
    await db.exec(await readFile(new URL('../supabase/migrations/20261105162821_teacher_template_defaults.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1), ($2)', [teacher, other]);
    for (const [id, owner] of [[template, teacher], [alternate, teacher], [foreign, other]]) {
      await db.query("insert into sala_templates(id,user_id,name,filename,path) values ($1,$2,'Modelo','prova.pdf','arquivo')", [id, owner]);
    }
    for (const id of [room, secondRoom]) {
      await db.query("insert into sala_classes(id,user_id,name,grade,subject) values ($1,$2,'7A','7','Matemática')", [id, teacher]);
    }
    await db.exec('set role authenticated');
    const login = id => db.query("select set_config('test.uid',$1,false)", [id]);
    const setDefault = id => db.query('insert into sala_teacher_template_defaults(template_id) values ($1) on conflict (user_id) do update set template_id=excluded.template_id', [id]);
    const effective = async id => (await db.query(`select case when use_provaai_template then null
      else coalesce(template_override_id,template_id) end as selected
      from sala_classes left join sala_teacher_template_defaults using(user_id) where id=$1`, [id])).rows[0].selected;
    await login(teacher);
    await setDefault(template);
    assert.equal(await effective(room), template);
    await db.query('update sala_classes set template_override_id=$1 where id=$2', [alternate, room]);
    assert.equal(await effective(room), alternate);
    assert.equal(await effective(secondRoom), template);
    await setDefault(null);
    assert.equal(await effective(room), alternate);
    assert.equal(await effective(secondRoom), null);
    await setDefault(template);
    await db.query('update sala_classes set template_override_id=null,use_provaai_template=true where id=$1', [room]);
    assert.equal(await effective(room), null);
    await db.query('update sala_classes set use_provaai_template=false where id=$1', [room]);
    assert.equal(await effective(room), template);
    await assert.rejects(setDefault(foreign), { code: '23503' });
    await assert.rejects(db.query('update sala_classes set template_override_id=$1 where id=$2', [foreign,room]), { code: '23503' });
    await login(other);
    await setDefault(foreign);
    assert.deepEqual((await db.query('select template_id from sala_teacher_template_defaults')).rows, [{template_id: foreign}]);
    assert.equal((await db.query('update sala_classes set template_override_id=$1 where id=$2 returning id',[foreign, room])).rows.length, 0);
    assert.equal((await db.query('update sala_teacher_template_defaults set template_id=null where user_id=$1 returning user_id',[teacher])).rows.length, 0);
    await login(teacher);
    assert.equal(await effective(room), template);
  } finally {
    await db.close();
  }
});
