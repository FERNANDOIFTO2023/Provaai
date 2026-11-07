import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  bannerGeometry,
  classColors,
  classIconValues,
} from "../lib/class-appearance.ts";
import { classSchema } from "../lib/model.ts";

test("recorte mantém a janela preenchida em retrato, paisagem e zoom, sem espaço vazio", () => {
  for (const [w, h] of [
    [1920, 1080],
    [600, 1800],
    [2400, 400],
    [500, 500],
  ])
    for (const zoom of [1, 1.5, 3])
      for (const x of [0, 0.5, 1])
        for (const y of [0, 0.5, 1]) {
          const crop = { x, y, zoom };
          const a = bannerGeometry(w, h, crop, 300),
            b = bannerGeometry(w, h, crop, 660);
          assert.ok(a.left <= 0 && a.top <= 0);
          assert.ok(a.left + a.width >= 300 - 1e-9);
          assert.ok(a.top + a.height >= 100 - 1e-9);
          for (const key of ["width", "height", "left", "top"])
            assert.ok(
              Math.abs(b[key] - a[key] * 2.2) < 1e-8,
              "mesmo recorte em tamanhos distintos",
            );
        }
  assert.deepEqual(bannerGeometry(0, 0, { x: 0, y: 0, zoom: 1 }), {
    width: 300,
    height: 100,
    left: 0,
    top: 0,
    overflowX: 0,
    overflowY: 0,
  });
});

test("dez cores e dez ícones são aceitos nas configurações", () => {
  assert.equal(new Set(classColors.map((item) => item.value)).size, 10);
  assert.equal(new Set(classIconValues).size, 10);
  for (const color of classColors)
    for (const icon of classIconValues)
      assert.equal(
        classSchema.safeParse({
          name: "Turma A",
          grade: "7",
          subject: "Ciências",
          color: color.value,
          icon,
        }).success,
        true,
      );
});

test("banners privados, configurações por turma e recortes válidos no banco", async () => {
  const db = new PGlite();
  const file = (name) =>
    readFile(new URL("../" + name, import.meta.url), "utf8");
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;
      grant usage on schema auth,storage to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
    const schema = await file("public/schema.sql");
    await db.exec(
      schema.slice(0, schema.indexOf("insert into storage.buckets")) +
        "commit;",
    );
    await db.exec(
      "alter table sala_templates add processing_status text default 'ready';",
    );
    for (const name of [
      "20261105162821_teacher_template_defaults",
      "20261105220532_teacher_exam_batch",
      "20261105235000_recovery_and_archived_students",
      "20261106161318_reactivate_student_in_class",
      "20261106181131_class_lifecycle_and_copies",
      "20261107001138_class_appearance",
    ])
      await db.exec(await file("supabase/migrations/" + name + ".sql"));
    const u = randomUUID(),
      other = randomUUID(),
      room = randomUUID(),
      otherRoom = randomUUID(),
      image = `${u}/${room}/${randomUUID()}.jpg`;
    await db.query("insert into auth.users(id) values($1),($2)", [u, other]);
    for (const [id, owner] of [
      [room, u],
      [otherRoom, other],
    ])
      await db.query(
        "insert into sala_classes(id,user_id,name,grade,subject) values($1,$2,'Turma','7','Ciências')",
        [id, owner],
      );
    assert.equal(
      (
        await db.query(
          "select public from storage.buckets where id='class-banners'",
        )
      ).rows[0].public,
      false,
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('test.uid',$1,false)", [u]);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('class-banners',$1)",
      [image],
    );
    const crop = { x: 0.2, y: 0.8, zoom: 1.75 };
    for (const color of classColors)
      for (const icon of classIconValues)
        await db.query(
          "update sala_classes set color=$1,icon=$2,banner_path=$3,banner_crop=$4 where id=$5",
          [color.value, icon, image, JSON.stringify(crop), room],
        );
    assert.deepEqual(
      (
        await db.query("select banner_crop from sala_classes where id=$1", [
          room,
        ])
      ).rows[0].banner_crop,
      crop,
    );
    await assert.rejects(
      db.query("update sala_classes set banner_path=$1 where id=$2", [
        `${other}/${otherRoom}/${randomUUID()}.jpg`,
        room,
      ]),
      /banner_owner/,
    );
    for (const bad of [
      { x: 0, y: 0, zoom: 4 },
      { x: -1, y: 0, zoom: 1 },
      { x: 0, y: 2, zoom: 1 },
      {},
      null,
    ])
      await assert.rejects(
        db.query("update sala_classes set banner_crop=$1 where id=$2", [
          JSON.stringify(bad),
          room,
        ]),
      );
    await db.query("select set_config('test.uid',$1,false)", [other]);
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [image]))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update sala_classes set color=$1 where id=$2 returning id",
          ["rose", room],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('class-banners',$1)",
        [image],
      ),
      /row-level security/,
    );
    await db.query("delete from storage.objects where name=$1", [image]);
    await db.query("select set_config('test.uid',$1,false)", [u]);
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [image]))
        .rows.length,
      1,
    );
    await db.query("update sala_classes set banner_path=null where id=$1", [
      room,
    ]);
    await db.query("delete from storage.objects where name=$1", [image]);
    assert.equal(
      (await db.query("select * from storage.objects where name=$1", [image]))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
