import test from "node:test";
import assert from "node:assert/strict";
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
